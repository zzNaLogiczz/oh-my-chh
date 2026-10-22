import { describe, expect, it, vi } from "vitest";
import {
  cellAddress, columnLabel, forumIndexGrid, searchGrid, threadDetailGrid, threadListGrid, workbookGrid
} from "../../src/remake/excel/app/grid-model";
import { renderGrid } from "../../src/remake/excel/app/grid";
import { renderShell } from "../../src/remake/excel/app/shell";
import { parsePage } from "../../src/remake/excel/parse";
import type { ForumIndexPage, SearchPage, ThreadDetailPage, ThreadListPage } from "../../src/remake/excel/model";
import type { WbSheet } from "../../src/remake/excel/workbook/model";
import { loadExcelFixture } from "./helpers/excel-fixtures";

const forumIndex = parsePage(loadExcelFixture("forum-index"), "https://www.chiphell.com/forum.php") as ForumIndexPage;
const threadList = parsePage(loadExcelFixture("thread-list"), "https://www.chiphell.com/forum-283-1.html") as ThreadListPage;
const detail = parsePage(loadExcelFixture("thread-2904948"), "https://www.chiphell.com/thread-2904948-1-1.html") as ThreadDetailPage;
const search = parsePage(loadExcelFixture("search"), "https://www.chiphell.com/search.php?mod=forum&searchid=2604&kw=5090") as SearchPage;

const texts = (row: { cells: ({ text: string } | undefined)[] }) => row.cells.map((cell) => cell?.text ?? "");

describe("cell addressing", () => {
  it("labels columns like Excel", () => {
    expect([0, 25, 26, 27].map(columnLabel)).toEqual(["A", "Z", "AA", "AB"]);
    expect(cellAddress(1, 2)).toBe("C2");
  });
});

describe("forum grids", () => {
  it("lays out the forum index with a merged title, header and category rows", () => {
    const grid = forumIndexGrid(forumIndex);
    expect(grid.columns).toHaveLength(6);
    expect(texts(grid.rows[1])).toEqual(["版块", "今日", "主题", "帖子", "最后发表", "最后发表人"]);
    expect(grid.merges).toContainEqual({ r1: 0, c1: 0, r2: 0, c2: 5 });
    const group = grid.rows.findIndex((row) => row.cells[0]?.text === "我收藏的版块");
    expect(group).toBeGreaterThan(2);
    expect(grid.merges).toContainEqual({ r1: group, c1: 0, r2: group, c2: 5 });
    expect(grid.rows[group + 1].url).toBe("https://www.chiphell.com/forum-312-1.html");
    expect(grid.rows[group + 1].cells[1]).toMatchObject({ text: "3963", style: { hAlign: "right" } });
    expect(grid.frozenRows).toBe(2);
  });

  it("highlights pinned threads in the thread list", () => {
    const grid = threadListGrid(threadList);
    expect(texts(grid.rows[1])).toEqual(["标题", "作者", "发表时间", "回复", "查看", "最后回复", "回复人"]);
    expect(grid.rows[0].cells[0]?.text).toBe("大恶魔的Blog");
    expect(grid.rows[2].cells[0]?.style?.fill).toBe("#fff2cc");
    const normal = grid.rows.find((row) => row.key === "2260366")!;
    expect(normal.cells[0]?.style?.fill).toBeUndefined();
    expect(normal.url).toBe("https://www.chiphell.com/thread-2260366-1-1.html");
  });

  it("summarizes each floor and flags the comment cell", () => {
    const grid = threadDetailGrid(detail);
    expect(texts(grid.rows[1])).toEqual(["楼层", "作者", "摘要", "时间"]);
    const first = grid.rows[2];
    expect(first.key).toBe(detail.posts[0].pid);
    expect(first.cells[2]?.comment).toBe(true);
    expect(first.cells[2]?.text.length).toBeLessThanOrEqual(41);
    expect(first.cells[2]?.text.startsWith("前段时间")).toBe(true);
  });

  it("lists search results", () => {
    const grid = searchGrid(search);
    expect(texts(grid.rows[1])).toEqual(["标题", "版块", "作者", "时间", "回复", "查看"]);
    expect(grid.rows[0].cells[0]?.text).toContain("5090");
    expect(grid.rows[2].cells[0]?.text).toBe("5090D的Strata推理速度问题");
  });
});

describe("workbookGrid", () => {
  it("maps workbook cells, styles and merges", () => {
    const sheet: WbSheet = {
      name: "对账明细", rowCount: 3, colCount: 3, colWidths: [145, 64, 64], rowHeights: [20, 40, 20],
      cells: [{ r: 0, c: 0, text: "季度对账", s: 0 }, { r: 2, c: 2, text: "30", formula: "=SUM(A3:B3)", s: 1 }],
      merges: [{ r1: 0, c1: 0, r2: 0, c2: 2 }], frozenRows: 1, frozenCols: 0, truncated: false
    };
    const grid = workbookGrid(sheet, [{ bold: true }, { hAlign: "right" }]);
    expect(grid.columns.map((c) => c.width)).toEqual([145, 64, 64]);
    expect(grid.rows[1].height).toBe(40);
    expect(grid.rows[0].cells[0]).toMatchObject({ text: "季度对账", style: { bold: true } });
    expect(grid.rows[2].cells[2]).toMatchObject({ text: "30", formula: "=SUM(A3:B3)", style: { hAlign: "right" } });
    expect(grid.merges).toEqual(sheet.merges);
    expect(grid.frozenRows).toBe(1);
  });
});

describe("renderGrid", () => {
  it("selects cells on click and activates data rows on Enter", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const grid = threadListGrid(threadList);
    const handlers = { onSelect: vi.fn(), onActivate: vi.fn(), onNearEnd: vi.fn() };
    renderGrid(host, grid, handlers);

    const cell = host.querySelector<HTMLElement>('[data-r="2"][data-c="0"]')!;
    cell.click();
    expect(handlers.onSelect).toHaveBeenCalledWith(2, 0, grid.rows[2].cells[0]);
    expect(cell.classList.contains("xl-sel")).toBe(true);

    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(handlers.onActivate).toHaveBeenCalledWith(grid.rows[2], grid.rows[2].cells[0]);

    host.querySelector<HTMLElement>('[data-r="1"][data-c="0"]')!.click();
    handlers.onActivate.mockClear();
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(handlers.onActivate).not.toHaveBeenCalled();
  });

  it("moves the selection with arrow keys, landing on a merge master inside merged ranges", () => {
    const host = document.createElement("div");
    const grid = forumIndexGrid(forumIndex);
    const handlers = { onSelect: vi.fn(), onActivate: vi.fn(), onNearEnd: vi.fn() };
    renderGrid(host, grid, handlers);
    expect(host.querySelector<HTMLTableCellElement>('[data-r="0"][data-c="0"]')!.colSpan).toBe(6);
    expect(host.querySelector('[data-r="0"][data-c="1"]')).toBeNull();
    // 分类行跨列合并：从它上一行的 B 列向下进入合并区域时选中其主格（A 列）
    const group = grid.rows.findIndex((row) => row.cells[0]?.text === "我收藏的版块");
    host.querySelector<HTMLElement>(`[data-r="${group - 1}"][data-c="1"]`)!.click();
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(handlers.onSelect).toHaveBeenLastCalledWith(group, 0, grid.rows[group].cells[0]);
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(handlers.onSelect).toHaveBeenLastCalledWith(group + 1, 0, grid.rows[group + 1].cells[0]);
  });

  it("pins the row numbers of frozen rows together with their cells", () => {
    const host = document.createElement("div");
    const rows = [{ cells: [{ text: "标题" }] }, { cells: [{ text: "表头" }] }, { cells: [{ text: "1" }] }];
    renderGrid(host, { columns: [{ width: 64 }], rows, merges: [], frozenRows: 2, frozenCols: 0 }, { onSelect: vi.fn(), onActivate: vi.fn(), onNearEnd: vi.fn() });
    const heads = [...host.querySelectorAll<HTMLElement>("tbody .xl-rowhead")];
    const cell = (r: number) => host.querySelector<HTMLElement>(`td[data-r="${r}"][data-c="0"]`)!;
    for (const r of [0, 1]) {
      expect(heads[r].classList.contains("xl-frozen-row")).toBe(true);
      expect(heads[r].style.top).toBe(cell(r).style.top);
    }
    expect(heads[2].classList.contains("xl-frozen-row")).toBe(false);
  });

  it("writes cell text as text, never as markup", () => {
    const host = document.createElement("div");
    renderGrid(host, { columns: [{ width: 64 }], rows: [{ cells: [{ text: "<img src=x onerror=alert(1)>" }] }], merges: [], frozenRows: 0, frozenCols: 0 },
      { onSelect: vi.fn(), onActivate: vi.fn(), onNearEnd: vi.fn() });
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("renderShell", () => {
  it("renders title, sheet tabs and forwards sheet selection", () => {
    const root = document.createElement("div");
    const onSheetSelect = vi.fn();
    const shell = renderShell(root, {
      title: "工作簿1.xlsx - Excel", onRibbonTab: vi.fn(), onFileCommand: vi.fn(), onImagesToggle: vi.fn(), onSheetSelect
    });
    shell.setTitle("Q4.xlsx - Excel");
    expect(root.querySelector(".xl-title")!.textContent).toBe("Q4.xlsx - Excel");
    shell.setSheets(["对账明细", "Sheet2"], 1);
    const tabs = root.querySelectorAll<HTMLElement>(".xl-sheet-tab");
    expect([...tabs].map((t) => t.textContent)).toEqual(["对账明细", "Sheet2"]);
    expect(tabs[1].classList.contains("is-active")).toBe(true);
    tabs[0].click();
    expect(onSheetSelect).toHaveBeenCalledWith(0);
  });

  it("opens the File menu and forwards commands", () => {
    const root = document.createElement("div");
    const onFileCommand = vi.fn();
    renderShell(root, { title: "t", onRibbonTab: vi.fn(), onFileCommand, onImagesToggle: vi.fn(), onSheetSelect: vi.fn() });
    root.querySelector<HTMLElement>('[data-tab="file"]')!.click();
    root.querySelector<HTMLElement>('[data-command="open-original"]')!.click();
    expect(onFileCommand).toHaveBeenCalledWith("open-original");
  });

  it("exposes the show-images toggle on the View tab", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onImagesToggle = vi.fn();
    const shell = renderShell(root, { title: "t", onRibbonTab: vi.fn(), onFileCommand: vi.fn(), onImagesToggle, onSheetSelect: vi.fn() });
    shell.setImagesChecked(true);
    const box = root.querySelector<HTMLInputElement>("#xl-show-images")!;
    expect(box.checked).toBe(true);
    box.click();
    expect(onImagesToggle).toHaveBeenCalledWith(false);
  });
});
