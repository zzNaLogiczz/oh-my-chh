import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExcelApp, type ExcelAppHandle } from "../../src/remake/excel/app/app";
import { renderGrid } from "../../src/remake/excel/app/grid";
import { articleGrid, fitFlexColumn, forumIndexGrid, portalListGrid } from "../../src/remake/excel/app/grid-model";
import { scrollToReveal } from "../../src/remake/excel/app/scroll";
import { renderShell, type NavState } from "../../src/remake/excel/app/shell";
import { parsePage } from "../../src/remake/excel/parse";
import type { ArticlePage, ExcelPage, ForumIndexPage, PortalListPage, ThreadDetailPage } from "../../src/remake/excel/model";
import type { AppToHost, HostToApp } from "../../src/remake/excel/protocol";
import { DEFAULT_EXCEL_PREFS } from "../../src/remake/excel/prefs";
import { loadExcelFixture } from "./helpers/excel-fixtures";

const load = <T extends ExcelPage>(fixture: string, url: string) => parsePage(loadExcelFixture(fixture), url) as T;
const INDEX_URL = "https://www.chiphell.com/forum.php";
const forumIndex = load<ForumIndexPage>("forum-index", INDEX_URL);
const portalList = load<PortalListPage>("portal-list", "https://www.chiphell.com/portal.php?mod=list&catid=1");
const article = load<ArticlePage>("article", "https://www.chiphell.com/article-35543-1.html");
const texts = (row: { cells: ({ text: string } | undefined)[] }) => row.cells.map((cell) => cell?.text ?? "");

describe("navigation grids", () => {
  it("puts the channel navigation above the boards, one channel per row with clickable sub-categories", () => {
    const grid = forumIndexGrid(forumIndex);
    expect(grid.rows[2].cells[0]?.text).toBe("频道导航");
    const review = grid.rows[3];
    expect(review.url).toBeUndefined();
    expect(review.cells[0]).toMatchObject({ text: "评测", url: "https://www.chiphell.com/portal.php?mod=list&catid=1" });
    expect(review.cells[1]).toMatchObject({ text: "视频评测", url: "https://www.chiphell.com/portal.php?mod=list&catid=39" });
    // 二级分类每行最多 5 个，只占表格本身的 B–F 列，多出的折到下一行（A 列留空）
    expect(review.cells).toHaveLength(6);
    expect(grid.rows[4].cells[0]).toBeUndefined();
    expect(grid.rows[4].cells[1]).toMatchObject({ text: forumIndex.channels[0].subs[5].name });
    const navRows = forumIndex.channels.reduce((sum, channel) => sum + Math.max(1, Math.ceil(channel.subs.length / 5)), 0);
    const firstBoardGroup = grid.rows.findIndex((row) => row.cells[0]?.text === "我收藏的版块");
    expect(firstBoardGroup).toBe(3 + navRows);
    expect(grid.rows.slice(3, firstBoardGroup).every((row) => row.cells.length <= 6)).toBe(true);
    expect(grid.rows[firstBoardGroup + 1].url).toBe("https://www.chiphell.com/forum-312-1.html");
  });

  it("lists channel articles; the category cell opens that sub-category", () => {
    const grid = portalListGrid(portalList);
    expect(grid.rows[0].cells[0]?.text).toBe("评测");
    expect(texts(grid.rows[1])).toEqual(["标题", "分类", "发布时间", "摘要"]);
    expect(grid.frozenRows).toBe(2);
    expect(grid.flexColumn).toBe(3);
    expect(grid.rows[2]).toMatchObject({ key: "35543", url: "https://www.chiphell.com/article-35543-1.html" });
    expect(grid.rows[2].cells[0]?.url).toBeUndefined();
    expect(grid.rows[2].cells[1]).toMatchObject({ text: "主板", url: "https://www.chiphell.com/portal.php?mod=list&catid=15" });
  });

  it("shows an article as body + comments rows, labelling the body row", () => {
    const grid = articleGrid(article);
    expect(grid.rows[0].cells[0]?.text).toBe("ASUS ProArt B850-Creator WiFi Neo 评测");
    expect(grid.rows[2].cells[0]?.text).toBe("正文");
    expect(grid.rows[2].key).toBe(article.posts[0].pid);
    expect(grid.rows[3].cells[0]?.text).toBe("1");
  });
});

describe("layout helpers", () => {
  it("never reveals a cell underneath the sticky row header", () => {
    // 可视区：[scroll + sticky, scroll + viewport]
    expect(scrollToReveal(40, 200, 40, 600, 40)).toBe(0);
    expect(scrollToReveal(300, 100, 0, 600, 40)).toBe(0);
    expect(scrollToReveal(900, 100, 0, 600, 40)).toBe(400);
    // 比可视区还宽的格子：左边缘贴着 sticky 区
    expect(scrollToReveal(100, 1000, 0, 600, 40)).toBe(60);
  });

  it("shrinks the flexible column so data columns fit, never below its minimum or above its design width", () => {
    const columns = [{ width: 400 }, { width: 110 }, { width: 130 }];
    expect(fitFlexColumn(columns, 0, 1280)).toBe(400);
    expect(fitFlexColumn(columns, 0, 600)).toBe(600 - 40 - 240 - 2);
    expect(fitFlexColumn(columns, 0, 300)).toBe(160);
    expect(fitFlexColumn(columns, 0, 0)).toBe(400);
  });
});

describe("grid width", () => {
  it("pins the table width to the column widths so long text cannot widen columns", () => {
    const host = document.createElement("div");
    renderGrid(host, { columns: [{ width: 100 }, { width: 50 }], rows: [{ cells: [{ text: "x".repeat(500) }] }], merges: [], frozenRows: 0, frozenCols: 0 },
      { onSelect: vi.fn(), onActivate: vi.fn(), onNearEnd: vi.fn() });
    expect(host.querySelector<HTMLElement>(".xl-table")!.style.width).toBe(`${40 + 100 + 50 + 64 * 24}px`);
  });
});

describe("cell links", () => {
  it("activates a cell's own link before the row's", () => {
    const host = document.createElement("div");
    const grid = forumIndexGrid(forumIndex);
    const onActivate = vi.fn();
    renderGrid(host, grid, { onSelect: vi.fn(), onActivate, onNearEnd: vi.fn() });
    const sub = host.querySelector<HTMLElement>('[data-r="3"][data-c="1"]')!;
    expect(sub.classList.contains("xl-link")).toBe(true);
    sub.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(onActivate).toHaveBeenCalledWith(grid.rows[3], grid.rows[3].cells[1]);
  });
});

describe("ribbon navigation group", () => {
  const state: NavState = { canBack: true, parent: { name: "版块列表", url: INDEX_URL }, page: 3, lastPage: 3, totalPages: 9, canPrev: true, canNext: true };

  it("stays hidden until the forum sheet supplies a state", () => {
    const root = document.createElement("div");
    const shell = renderShell(root, { title: "t", onRibbonTab: vi.fn(), onFileCommand: vi.fn(), onImagesToggle: vi.fn(), onSheetSelect: vi.fn(), onNav: vi.fn() });
    const group = root.querySelector<HTMLElement>(".xl-navgroup")!;
    expect(group.hidden).toBe(true);
    shell.setNav(state);
    expect(group.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>(".xl-page-input")!.value).toBe("3");
    expect(root.querySelector(".xl-page-total")!.textContent).toBe("9");
    expect(root.querySelector<HTMLElement>('[data-nav="up"]')!.title).toBe("返回 版块列表");
    shell.setNav(null);
    expect(group.hidden).toBe(true);
  });

  it("forwards back, up, prev, next and page jumps, and disables what is unavailable", () => {
    const root = document.createElement("div");
    const onNav = vi.fn();
    const shell = renderShell(root, { title: "t", onRibbonTab: vi.fn(), onFileCommand: vi.fn(), onImagesToggle: vi.fn(), onSheetSelect: vi.fn(), onNav });
    shell.setNav(state);
    for (const action of ["back", "up", "prev", "next"]) root.querySelector<HTMLElement>(`[data-nav="${action}"]`)!.click();
    expect(onNav.mock.calls.map(([a]) => a)).toEqual([{ kind: "back" }, { kind: "up" }, { kind: "prev" }, { kind: "next" }]);
    const input = root.querySelector<HTMLInputElement>(".xl-page-input")!;
    input.value = "7";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onNav).toHaveBeenLastCalledWith({ kind: "jump", page: 7 });
    shell.setNav({ ...state, canBack: false, parent: null, canPrev: false, canNext: false, totalPages: 1, page: 1, lastPage: 1 });
    for (const action of ["back", "up", "prev", "next"]) {
      expect(root.querySelector<HTMLButtonElement>(`[data-nav="${action}"]`)!.disabled).toBe(true);
    }
    expect(input.disabled).toBe(true);
  });
});

describe("app navigation", () => {
  let channel: MessageChannel;
  let received: AppToHost[];
  let app: ExcelAppHandle;
  let root: HTMLElement;

  beforeEach(() => {
    sessionStorage.setItem("omchh-excel-forum", "1");
    document.body.innerHTML = "";
    channel = new MessageChannel();
    received = [];
    channel.port1.onmessage = (event) => received.push(event.data as AppToHost);
    root = document.createElement("div");
    document.body.append(root);
    app = createExcelApp(root, { port: channel.port2, prefs: DEFAULT_EXCEL_PREFS, workbook: null, openOptions: vi.fn() });
  });
  afterEach(() => {
    app.destroy();
    channel.port1.close();
    channel.port2.close();
    sessionStorage.clear();
  });

  const show = async (page: ExcelPage, url: string, canBack = false) => {
    channel.port1.postMessage({ type: "page", requestId: 1, url, page, append: false, canBack } satisfies HostToApp);
    await vi.waitFor(() => expect(root.querySelector(".xl-forum .xl-table")).not.toBeNull());
  };
  const click = (action: string) => root.querySelector<HTMLElement>(`[data-nav="${action}"]`)!.click();
  const navigated = (url: string) => vi.waitFor(() => expect(received).toContainEqual({ type: "navigate", url, append: false }));

  it("pages through a thread list and returns to the board list", async () => {
    const list = load<ExcelPage>("thread-list", "https://www.chiphell.com/forum-283-1.html");
    await show(list, "https://www.chiphell.com/forum-283-1.html");
    expect(root.querySelector<HTMLElement>(".xl-navgroup")!.hidden).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-nav="prev"]')!.disabled).toBe(true);
    click("next");
    await navigated("https://www.chiphell.com/forum-283-2.html");
    click("up");
    await navigated(INDEX_URL);
  });

  it("asks the host to go back only when it reported an in-app step", async () => {
    await show(forumIndex, INDEX_URL, false);
    expect(root.querySelector<HTMLButtonElement>('[data-nav="back"]')!.disabled).toBe(true);
    await show(forumIndex, INDEX_URL, true);
    await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('[data-nav="back"]')!.disabled).toBe(false));
    click("back");
    await vi.waitFor(() => expect(received).toContainEqual({ type: "back" }));
  });

  it("opens a channel from the navigation rows", async () => {
    await show(forumIndex, INDEX_URL);
    const cell = [...root.querySelectorAll<HTMLElement>(".xl-forum td.xl-link")].find((td) => td.textContent === "视频评测")!;
    cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await navigated("https://www.chiphell.com/portal.php?mod=list&catid=39");
  });

  it("jumps to a typed page within the article and keeps the comments pane", async () => {
    await show(article, "https://www.chiphell.com/article-35543-1.html");
    expect(root.querySelector(".xl-comments")).not.toBeNull();
    const input = root.querySelector<HTMLInputElement>(".xl-page-input")!;
    input.value = "4";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await navigated("https://www.chiphell.com/article-35543-4.html");
  });

  it("keeps a thread's list page as its parent while paging inside the thread", async () => {
    const first = load<ExcelPage>("thread-2904948", "https://www.chiphell.com/thread-2904948-1-3.html");
    await show(first, "https://www.chiphell.com/thread-2904948-1-3.html");
    // 帖内翻页的地址不带列表页码：解析出的上级会是列表第 1 页
    const second = { ...load<ThreadDetailPage>("thread-2904948", "https://www.chiphell.com/forum.php?mod=viewthread&tid=2904948&extra=&page=2"), title: "第二页" };
    expect(second.parent?.url).toBe("https://www.chiphell.com/forum-319-1.html");
    await show(second, "https://www.chiphell.com/forum.php?mod=viewthread&tid=2904948&extra=&page=2");
    await vi.waitFor(() => expect(root.querySelector('.xl-forum td[data-r="0"]')!.textContent).toBe("第二页"));
    click("up");
    await navigated("https://www.chiphell.com/forum-319-3.html");
  });

  it("hides the navigation group on workbook sheets so the boss view stays plain Excel", async () => {
    await show(forumIndex, INDEX_URL);
    app.toggleBoss();
    expect(app.mode).toBe("workbook");
    expect(root.querySelector<HTMLElement>(".xl-navgroup")!.hidden).toBe(true);
  });
});
