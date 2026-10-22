// 论坛工作表：按页面类型画网格（帖子详情 / 门户文章额外带批注窗格），支持滚动追加下一页与回帖
import type { ArticlePage, ExcelPage, NavLink, PageInfo, ThreadDetailPage } from "../model";
import { findPostUrl } from "../parse/common";
import type { ReplyOutcome, ReplyRequest } from "../protocol";
import { renderCommentsPane, type CommentsHandle, type ReplyHandlers, type ReplyResult } from "./comments";
import { renderGrid, type GridHandle } from "./grid";
import {
  articleGrid, cellAddress, forumIndexGrid, portalListGrid, portalListRows, searchGrid, searchRows, threadDetailGrid,
  threadDetailRows, threadListGrid, threadListRows, type GridCell, type GridModel, type GridRow
} from "./grid-model";
import type { ImageVisibility } from "./image-visibility";
import { closeLightbox } from "./lightbox";

export interface ForumViewEvents {
  onFormula(address: string, text: string): void;
  onNavigate(url: string, append: boolean): void;
  /** 页面或已加载页码区间变化（整页显示 / 滚动追加）时通知，供功能区导航组刷新 */
  onChange(): void;
  onReply(request: ReplyRequest): Promise<ReplyOutcome>;
}

/** 已加载的首页与末页分页信息：上一页从 first 往前，下一页从 last 往后 */
export interface ForumPager { first: PageInfo; last: PageInfo }

export interface ForumView {
  readonly element: HTMLElement;
  readonly page: ExcelPage | null;
  readonly url: string | null;
  readonly parent: NavLink | null;
  readonly pager: ForumPager | null;
  show(page: ExcelPage, url: string): void;
  append(page: ExcelPage): void;
  refreshImages(): void;
  focus(): void;
}

type DocPage = ThreadDetailPage | ArticlePage;

const FORUM_INDEX: NavLink = { name: "版块列表", url: "https://www.chiphell.com/forum.php" };
const EMPTY_GRID: GridModel = { columns: [], rows: [], merges: [], frozenRows: 0, frozenCols: 0 };

function gridFor(page: ExcelPage): GridModel {
  switch (page.kind) {
    case "forum-index": return forumIndexGrid(page);
    case "thread-list": return threadListGrid(page);
    case "thread-detail": return threadDetailGrid(page);
    case "search": return searchGrid(page);
    case "portal-list": return portalListGrid(page);
    case "article": return articleGrid(page);
    default: return EMPTY_GRID;
  }
}

/** 列表类页面滚动追加的行；帖子 / 文章要先去重，见 append */
function rowsFor(page: ExcelPage): GridRow[] {
  if (page.kind === "thread-list") return threadListRows(page);
  if (page.kind === "search") return searchRows(page);
  if (page.kind === "portal-list") return portalListRows(page);
  return [];
}

const isDoc = (page: ExcelPage | null): page is DocPage => page?.kind === "thread-detail" || page?.kind === "article";
const docId = (page: DocPage) => (page.kind === "thread-detail" ? `t${page.tid}` : `a${page.aid}`);
/** 楼层摘要所在列：选中楼层时选这一格 */
const SUMMARY_COL = 2;

export function createForumView(vis: ImageVisibility, events: ForumViewEvents): ForumView {
  const element = document.createElement("div");
  element.className = "xl-view xl-forum";
  let grid: GridHandle | null = null;
  let comments: CommentsHandle | null = null;
  let current: ExcelPage | null = null;
  let currentUrl: string | null = null;
  let parent: NavLink | null = null;
  let pager: ForumPager | null = null;
  let loadingMore = false;
  /** 网格当前全部行（含滚动追加的），批注卡片与行互相定位都查它 */
  let rows: GridRow[] = [];
  /** 已显示的楼层：回帖后重取最后一页时只追加新楼层 */
  let seen = new Set<string>();
  /** 回帖成功后要选中的楼层，等它所在的页显示出来 */
  let focusPid: string | null = null;
  /** 输入框草稿：同一帖子里翻页 / 重绘批注窗格后还在 */
  const drafts = new Map<string, string>();

  function onSelect(r: number, c: number, cell: GridCell | null): void {
    events.onFormula(cellAddress(r, c), cell?.formula ?? cell?.text ?? "");
    const key = rows[r]?.key;
    if (isDoc(current) && key) comments?.focusPost(key);
  }

  /**
   * 上级链接：帖内翻页的地址不带列表页码（会退回第 1 页），
   * 所以在同一帖子 / 文章内翻页时沿用进入时记下的上级。
   */
  function parentFor(page: ExcelPage): NavLink | null {
    const own = "parent" in page ? page.parent : null;
    if (isDoc(page) && isDoc(current) && docId(page) === docId(current)) return parent ?? own;
    return own;
  }

  function selectPost(pid: string): boolean {
    const r = rows.findIndex((row) => row.key === pid);
    if (r >= 0) grid?.select(r, SUMMARY_COL);
    return r >= 0;
  }

  function afterReply(page: ThreadDetailPage, outcome: ReplyOutcome): ReplyResult {
    // 需要审核之类的情况，服务器的原话比“已发布”有用
    const message = outcome.message.includes("审核") ? outcome.message : "已发布";
    const pid = outcome.pid;
    // 发送途中已经离开这个帖子：结果照常报告，不再动网格
    if (!pid || current !== page) return { ok: true, message };
    const url = findPostUrl(page.tid, pid);
    // 已加载到最后一页：新楼层就接在后面，原地追加，不打断阅读
    if (pager && pager.last.page >= pager.last.totalPages) {
      focusPid = pid;
      loadingMore = true;
      events.onNavigate(url, true);
      return { ok: true, message };
    }
    return { ok: true, message, view: () => { focusPid = pid; events.onNavigate(url, false); } };
  }

  function replyHandlers(page: ThreadDetailPage): ReplyHandlers | undefined {
    const form = page.reply;
    if (!form || !page.tid) return undefined;
    return {
      draftKey: `t${page.tid}`,
      drafts,
      submit: async (floor, message) => {
        const outcome = await events.onReply({
          tid: page.tid, fid: form.fid, formhash: form.formhash, message,
          floor: floor?.replyMode ? { pid: floor.pid, mode: floor.replyMode } : null
        });
        return outcome.ok ? afterReply(page, outcome) : { ok: false, message: outcome.message };
      }
    };
  }

  function show(page: ExcelPage, url: string): void {
    parent = page.kind === "notice" ? FORUM_INDEX : parentFor(page);
    closeLightbox();
    grid?.destroy();
    comments?.destroy();
    element.textContent = "";
    current = page;
    currentUrl = url;
    loadingMore = false;
    pager = "pageInfo" in page ? { first: page.pageInfo, last: page.pageInfo } : null;

    const model = gridFor(page);
    rows = [...model.rows];
    seen = new Set(isDoc(page) ? page.posts.map((post) => post.pid) : []);
    const gridHost = document.createElement("div");
    element.append(gridHost);
    grid = renderGrid(gridHost, model, {
      onSelect,
      // 帖子 / 文章的行是楼层索引（定位批注），其余行或格子是导航链接
      onActivate: (row, cell) => {
        if (isDoc(current)) { if (row.key) comments?.focusPost(row.key); return; }
        const target = cell?.url ?? row.url;
        if (target) events.onNavigate(target, false);
      },
      onNearEnd: () => {
        const next = pager?.last.nextUrl;
        if (!next || loadingMore) return;
        loadingMore = true;
        events.onNavigate(next, true);
      }
    });

    if (isDoc(page)) {
      const pane = document.createElement("div");
      element.append(pane);
      comments = renderCommentsPane(pane, page.posts, vis, {
        onCardSelect: (pid) => { selectPost(pid); },
        reply: page.kind === "thread-detail" ? replyHandlers(page) : undefined
      });
    } else {
      comments = null;
    }
    const wanted = focusPid;
    focusPid = null;
    if (wanted) selectPost(wanted);
    events.onChange();
  }

  function append(page: ExcelPage): void {
    // 只接受同类型页面的追加；类型不符（例如中途跳转）时忽略
    if (!current || page.kind !== current.kind) return;
    // 回帖后重取最后一页时，页里大部分楼层已经显示过，只追加新的
    const posts = isDoc(page) ? page.posts.filter((post) => !seen.has(post.pid)) : [];
    const next = isDoc(page) ? threadDetailRows(posts) : rowsFor(page);
    posts.forEach((post) => seen.add(post.pid));
    rows.push(...next);
    grid?.appendRows(next);
    if (posts.length) comments?.appendPosts(posts);
    if ("pageInfo" in page && pager) pager = { first: pager.first, last: page.pageInfo };
    loadingMore = false;
    if (focusPid && selectPost(focusPid)) focusPid = null;
    events.onChange();
  }

  return {
    element,
    get page() { return current; },
    get url() { return currentUrl; },
    get parent() { return parent; },
    get pager() { return pager; },
    show,
    append,
    refreshImages: () => comments?.refreshImages(),
    focus: () => element.querySelector<HTMLElement>(".xl-grid")?.focus({ preventScroll: true })
  };
}
