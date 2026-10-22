// Excel 应用主体（运行在扩展源 iframe 内）：工作表切换、老板键、图片开关、查找、与宿主通信
import { matchesShortcut } from "../keys";
import { excelWindowTitle, saveExcelPrefs, type ExcelPrefs } from "../prefs";
import type { AppToHost, HostToApp, ReplyOutcome, ReplyRequest } from "../protocol";
import type { ExcelPage } from "../model";
import { pageUrl } from "../parse/common";
import type { WorkbookModel } from "../workbook/model";
import { openFindDialog, searchUrl } from "./find-dialog";
import { createForumView } from "./forum-view";
import { createImageVisibility } from "./image-visibility";
import { closeLightbox } from "./lightbox";
import { renderShell, type FileCommand, type NavAction, type NavState } from "./shell";
import { createWorkbookView, type WorkbookView } from "./workbook-view";

export interface ExcelAppDeps {
  port: MessagePort;
  prefs: ExcelPrefs;
  workbook: WorkbookModel | null;
  openOptions(): void;
}

export interface ExcelAppHandle {
  readonly mode: "workbook" | "forum";
  toggleBoss(): void;
  destroy(): void;
}

export const FORUM_VISITED_KEY = "omchh-excel-forum";
const FORUM_INDEX_URL = "https://www.chiphell.com/forum.php";
const LOGIN_STATUS = "需要重新登录：文件 → 在浏览器中打开原网页";

/** 论坛工作表名：第一个未被导入工作表占用的 SheetN（N 从 2 起） */
export function forumSheetName(taken: string[]): string {
  for (let n = 2; ; n += 1) if (!taken.includes(`Sheet${n}`)) return `Sheet${n}`;
}

function sessionFlag(): boolean {
  try { return sessionStorage.getItem(FORUM_VISITED_KEY) === "1"; } catch { return false; }
}
function rememberForum(): void {
  try { sessionStorage.setItem(FORUM_VISITED_KEY, "1"); } catch { /* 隐私模式忽略 */ }
}

/** 帖子详情与门户文章都带批注窗格，功能区切到“审阅” */
const hasComments = (page: ExcelPage | null) => page?.kind === "thread-detail" || page?.kind === "article";

function noticeStatus(page: ExcelPage): string | null {
  if (page.kind !== "notice") return null;
  return page.reason === "login-required" ? LOGIN_STATUS : page.message;
}

function showAlert(host: HTMLElement, message: string): void {
  host.querySelector(".xl-dialog")?.remove();
  const dialog = document.createElement("div");
  dialog.className = "xl-dialog";
  const title = document.createElement("div");
  title.className = "xl-dialog-title";
  title.textContent = "提示";
  const body = document.createElement("div");
  body.className = "xl-dialog-body";
  body.textContent = message;
  const actions = document.createElement("div");
  actions.className = "xl-dialog-actions";
  const ok = document.createElement("button");
  ok.className = "xl-btn xl-btn-primary";
  ok.textContent = "确定";
  ok.addEventListener("click", () => dialog.remove());
  actions.append(ok);
  body.append(actions);
  dialog.append(title, body);
  host.append(dialog);
}

export function createExcelApp(root: HTMLElement, deps: ExcelAppDeps): ExcelAppHandle {
  let prefs = deps.prefs;
  const vis = createImageVisibility(prefs.imagesDefault);
  const workbookNames = deps.workbook?.sheets.length ? deps.workbook.sheets.map((s) => s.name) : ["Sheet1"];
  const sheetNames = [...workbookNames, forumSheetName(workbookNames)];
  const forumIndex = workbookNames.length;
  let active = -1;
  let lastWorkbookSheet = Math.min(deps.workbook?.activeSheet ?? 0, workbookNames.length - 1);
  let canBack = false;
  const post = (message: AppToHost) => deps.port.postMessage(message);
  const navigate = (url: string, append: boolean) => post({ type: "navigate", url, append });
  /** 回帖经宿主提交，回执按编号对上发起它的输入框 */
  let replySeq = 0;
  const pendingReplies = new Map<number, (outcome: ReplyOutcome) => void>();
  const reply = (request: ReplyRequest) => new Promise<ReplyOutcome>((resolve) => {
    const replyId = ++replySeq;
    pendingReplies.set(replyId, resolve);
    post({ type: "reply", replyId, request });
  });

  const shell = renderShell(root, {
    title: excelWindowTitle(prefs),
    onRibbonTab: () => undefined,
    onFileCommand: (cmd) => runFileCommand(cmd),
    onImagesToggle: (checked) => setImages(checked ? "show" : "hide"),
    onSheetSelect: (index) => showSheet(index),
    onNav: (action) => runNav(action)
  });
  shell.setImagesChecked(vis.globalDefault === "show");

  const forum = createForumView(vis, {
    onFormula: (address, text) => shell.setFormula(address, text),
    onNavigate: navigate,
    onChange: () => updateNav(),
    onReply: reply
  });
  const workbookViews: WorkbookView[] = workbookNames.map((_, index) =>
    createWorkbookView(deps.workbook, index, (address, text) => shell.setFormula(address, text)));
  for (const view of workbookViews) { view.element.hidden = true; shell.body.append(view.element); }
  forum.element.hidden = true;
  shell.body.append(forum.element);

  function showSheet(index: number): void {
    // 只切换可见性：论坛视图的 DOM 与滚动位置保留，老板键往返瞬时
    active = index;
    workbookViews.forEach((view, i) => { view.element.hidden = i !== index; });
    forum.element.hidden = index !== forumIndex;
    if (index === forumIndex) {
      rememberForum();
      shell.setActiveTab(hasComments(forum.page) ? "review" : "home");
      forum.focus();
    } else {
      lastWorkbookSheet = index;
      workbookViews[index].ensureRendered();
      shell.setActiveTab("home");
      workbookViews[index].focus();
    }
    shell.setSheets(sheetNames, index);
    updateNav();
  }

  /** 论坛工作表上才显示导航组；已加载区间 first..last 决定上一页 / 下一页 */
  function navState(): NavState | null {
    if (active !== forumIndex || !forum.page) return null;
    const pager = forum.pager;
    const first = pager?.first.page ?? 1;
    const last = pager?.last.page ?? 1;
    return {
      canBack,
      parent: forum.parent,
      page: first,
      lastPage: last,
      totalPages: pager?.last.totalPages ?? 1,
      canPrev: pager ? pageUrl(pager.first, first - 1) !== null : false,
      canNext: pager ? pageUrl(pager.last, last + 1) !== null : false
    };
  }

  function updateNav(): void {
    shell.setNav(navState());
  }

  function runNav(action: NavAction): void {
    if (action.kind === "back") { if (canBack) post({ type: "back" }); return; }
    if (action.kind === "up") { if (forum.parent) navigate(forum.parent.url, false); return; }
    const pager = forum.pager;
    if (!pager) return;
    const target = action.kind === "prev" ? pageUrl(pager.first, pager.first.page - 1)
      : action.kind === "next" ? pageUrl(pager.last, pager.last.page + 1)
      : pageUrl(pager.last, Math.min(action.page, pager.last.totalPages));
    if (target) navigate(target, false);
  }

  function toggleBoss(): void {
    // 大图铺满整个窗口，老板键必须先把它收掉
    closeLightbox();
    showSheet(active === forumIndex ? lastWorkbookSheet : forumIndex);
  }

  function setImages(value: "show" | "hide"): void {
    if (value === "hide") closeLightbox();
    vis.setGlobal(value);
    forum.refreshImages();
    shell.setImagesChecked(value === "show");
    prefs = { ...prefs, imagesDefault: value };
    void saveExcelPrefs(prefs).catch(() => undefined);
  }

  function runFileCommand(cmd: FileCommand): void {
    if (cmd === "open-original") post({ type: "open-original", url: forum.url ?? FORUM_INDEX_URL });
    else if (cmd === "forum-index") { showSheet(forumIndex); navigate(FORUM_INDEX_URL, false); }
    else deps.openOptions();
  }

  function onHostMessage(message: HostToApp): void {
    if (message.type === "hotkey") {
      if (message.action === "boss") toggleBoss();
      else setImages(vis.globalDefault === "show" ? "hide" : "show");
      return;
    }
    if (message.type === "reply-result") {
      pendingReplies.get(message.replyId)?.(message.outcome);
      pendingReplies.delete(message.replyId);
      return;
    }
    if (message.type === "loading") { shell.setStatus("正在计算..."); return; }
    if (message.type === "error") { shell.setStatus(message.message); showAlert(shell.root, message.message); return; }
    canBack = message.canBack;
    if (message.append) forum.append(message.page);
    else {
      forum.show(message.page, message.url);
      if (active === forumIndex) shell.setActiveTab(hasComments(message.page) ? "review" : "home");
    }
    shell.setStatus(noticeStatus(message.page) ?? "就绪");
  }

  // 捕获阶段监听：输入框内（如查找框）也能响应老板键；输入法组合中不触发
  const onKeyDown = (event: KeyboardEvent) => {
    if (matchesShortcut(event, prefs.bossKey)) { event.preventDefault(); event.stopPropagation(); toggleBoss(); return; }
    if (matchesShortcut(event, prefs.imagesKey)) { event.preventDefault(); event.stopPropagation(); setImages(vis.globalDefault === "show" ? "hide" : "show"); return; }
    if ((event.ctrlKey || event.metaKey) && event.code === "KeyF") {
      event.preventDefault();
      openFindDialog(shell.root, (keyword) => { showSheet(forumIndex); navigate(searchUrl(keyword), false); });
    }
  };
  window.addEventListener("keydown", onKeyDown, true);
  deps.port.onmessage = (event: MessageEvent) => onHostMessage(event.data as HostToApp);

  showSheet(sessionFlag() ? forumIndex : lastWorkbookSheet);

  return {
    get mode() { return active === forumIndex ? "forum" : "workbook"; },
    toggleBoss,
    destroy() {
      closeLightbox();
      window.removeEventListener("keydown", onKeyDown, true);
      deps.port.onmessage = null;
      root.textContent = "";
    }
  };
}
