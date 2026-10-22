// 宿主控制器：响应 iframe 的导航请求（抓取 → 解析 → 回传），维护浏览器历史，丢弃过期响应
import { matchesShortcut } from "../keys";
import { detectExcelRoute, parsePage } from "../parse";
import { excelWindowTitle, loadExcelPrefs, type ExcelPrefs } from "../prefs";
import type { AppToHost, HostToApp, ReplyOutcome, ReplyRequest } from "../protocol";
import type { ExcelPage } from "../model";
import { setExcelBypass } from "./bypass";
import { coverPage, guardFavicon, guardTitle, removeSkeleton } from "./cover";
import { fetchExcelPage } from "./fetch-page";
import { mountAppFrame } from "./frame";
import { submitReply } from "./reply";

type Loaded = { page: ExcelPage; url: string };
const NETWORK_ERROR = "无法连接到数据源，请检查网络后重试。";
const FORUM_INDEX_URL = "https://www.chiphell.com/forum.php";

export function createRequestGate(): { begin(): number; isLatest(id: number): boolean } {
  let latest = 0;
  return { begin: () => ++latest, isLatest: (id) => id === latest };
}

export interface HostControllerDeps {
  port: MessagePort;
  fetchPage(url: string): Promise<Loaded>;
  initialPage(): Promise<Loaded>;
  submitReply(request: ReplyRequest): Promise<ReplyOutcome>;
  pushState(url: string): void;
  /** 只有应用内 pushState 产生过的历史才允许后退，避免一步退出 chh 到别的网站 */
  canGoBack(): boolean;
  goBack(): void;
  currentUrl(): string;
  openOriginal(url: string): void;
  onReady?(): void;
}

export function createHostController(deps: HostControllerDeps): { onPopState(): void; dispose(): void } {
  const gate = createRequestGate();
  const send = (message: HostToApp) => deps.port.postMessage(message);

  async function load(request: () => Promise<Loaded>, url: string, append: boolean, push: boolean): Promise<void> {
    const requestId = gate.begin();
    send({ type: "loading", requestId, url });
    try {
      const loaded = await request();
      // 连续点击时只渲染最后一次请求，早发晚到的响应直接丢弃
      if (!gate.isLatest(requestId)) return;
      if (push) deps.pushState(loaded.url);
      send({ type: "page", requestId, url: loaded.url, page: loaded.page, append, canBack: deps.canGoBack() });
    } catch {
      if (gate.isLatest(requestId)) send({ type: "error", requestId, url, message: NETWORK_ERROR });
    }
  }

  deps.port.onmessage = (event: MessageEvent) => {
    const message = event.data as AppToHost;
    if (message.type === "ready") {
      deps.onReady?.();
      void load(deps.initialPage, deps.currentUrl(), false, false);
    } else if (message.type === "navigate") {
      void load(() => deps.fetchPage(message.url), message.url, message.append, !message.append);
    } else if (message.type === "back") {
      if (deps.canGoBack()) deps.goBack();
    } else if (message.type === "open-original") {
      deps.openOriginal(message.url);
    } else if (message.type === "reply") {
      // 回帖不走请求闸门：它和翻页互不影响，每次提交都要有回音
      void deps.submitReply(message.request)
        .catch((): ReplyOutcome => ({ ok: false, message: NETWORK_ERROR, pid: null }))
        .then((outcome) => send({ type: "reply-result", replyId: message.replyId, outcome }));
    }
  };

  return {
    onPopState: () => { void load(() => deps.fetchPage(deps.currentUrl()), deps.currentUrl(), false, false); },
    dispose: () => { deps.port.onmessage = null; }
  };
}

function domReady(doc: Document): Promise<void> {
  if (doc.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => doc.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

/** 初始数据：门户首页改抓版块列表；其他页面直接解析当前文档，省一次请求 */
async function initialPage(win: Window): Promise<Loaded> {
  const href = win.location.href;
  if (detectExcelRoute(new URL(href)) === "portal-home") {
    const loaded = await fetchExcelPage(FORUM_INDEX_URL);
    return { page: loaded.page, url: href };
  }
  await domReady(win.document);
  return { page: parsePage(win.document, href), url: href };
}

/** 页面层快捷键：焦点不在 iframe 内时也能老板键 / 切图片，转发给应用后把焦点交回 iframe */
function bindPageHotkeys(win: Window, prefs: ExcelPrefs, frame: HTMLIFrameElement, port: Promise<MessagePort>): void {
  win.addEventListener("keydown", (event) => {
    const action = matchesShortcut(event, prefs.bossKey) ? "boss" : matchesShortcut(event, prefs.imagesKey) ? "images" : null;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    void port.then((p) => { p.postMessage({ type: "hotkey", action } satisfies HostToApp); frame.focus(); });
  }, true);
}

/** 应用内历史深度存在 history.state 里：刷新后仍在，回到进入 chh 的第一页时为 0 */
function historyDepth(win: Window): number {
  const state = win.history.state as { omchhExcelDepth?: unknown } | null;
  return typeof state?.omchhExcelDepth === "number" ? state.omchhExcelDepth : 0;
}

export async function startExcelHost(win: Window): Promise<void> {
  const doc = win.document;
  // 第一步同步遮住原站，再异步读取显示文件名
  coverPage(doc);
  const prefs = await loadExcelPrefs();
  guardTitle(doc, excelWindowTitle(prefs));
  guardFavicon(doc);
  const { frame, port } = mountAppFrame(doc, chrome.runtime.getURL("excel/app.html"));
  bindPageHotkeys(win, prefs, frame, port);
  const controller = createHostController({
    port: await port,
    fetchPage: fetchExcelPage,
    initialPage: () => initialPage(win),
    submitReply,
    pushState: (url) => {
      if (url !== win.location.href) win.history.pushState({ omchhExcel: 1, omchhExcelDepth: historyDepth(win) + 1 }, "", url);
    },
    canGoBack: () => historyDepth(win) > 0,
    goBack: () => win.history.back(),
    currentUrl: () => win.location.href,
    openOriginal: (url) => { setExcelBypass(url); win.location.href = url; },
    onReady: () => { removeSkeleton(doc); frame.focus(); }
  });
  win.addEventListener("popstate", () => controller.onPopState());
}
