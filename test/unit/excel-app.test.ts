import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExcelApp, type ExcelAppHandle } from "../../src/remake/excel/app/app";
import { parsePage } from "../../src/remake/excel/parse";
import type { AppToHost, HostToApp } from "../../src/remake/excel/protocol";
import { DEFAULT_EXCEL_PREFS } from "../../src/remake/excel/prefs";
import type { WbSheet, WorkbookModel } from "../../src/remake/excel/workbook/model";
import { loadExcelFixture } from "./helpers/excel-fixtures";

const sheet = (name: string): WbSheet => ({
  name, rowCount: 2, colCount: 2, colWidths: [80, 80], rowHeights: [20, 20],
  cells: [{ r: 0, c: 0, text: `${name}-A1` }], merges: [], frozenRows: 0, frozenCols: 0, truncated: false
});
const workbook = (...names: string[]): WorkbookModel => ({
  version: 1, fileName: "Q4.xlsx", importedAt: "2026-10-21T00:00:00.000Z", styles: [], activeSheet: 0, sheets: names.map(sheet)
});

let channel: MessageChannel;
let received: AppToHost[];
let app: ExcelAppHandle;
let root: HTMLElement;

function start(wb: WorkbookModel | null = workbook("对账明细", "汇总")) {
  root = document.createElement("div");
  document.body.append(root);
  app = createExcelApp(root, { port: channel.port2, prefs: { ...DEFAULT_EXCEL_PREFS, displayName: "Q4.xlsx" }, workbook: wb, openOptions: vi.fn() });
}
const send = (message: HostToApp) => channel.port1.postMessage(message);
const tabs = () => [...root.querySelectorAll(".xl-sheet-tab")].map((t) => t.textContent);
const activeTab = () => root.querySelector(".xl-sheet-tab.is-active")?.textContent;
const press = (init: KeyboardEventInit) => window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
const forumIndex = parsePage(loadExcelFixture("forum-index"), "https://www.chiphell.com/forum.php");

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = "";
  channel = new MessageChannel();
  received = [];
  channel.port1.onmessage = (event) => received.push(event.data as AppToHost);
});
afterEach(() => {
  app?.destroy();
  channel.port1.close();
  channel.port2.close();
});

describe("excel app", () => {
  it("shows imported sheets plus one neutral forum sheet and starts on the workbook", () => {
    start();
    expect(tabs()).toEqual(["对账明细", "汇总", "Sheet2"]);
    expect(app.mode).toBe("workbook");
    expect(activeTab()).toBe("对账明细");
    expect(root.querySelector(".xl-title")?.textContent).toBe("Q4.xlsx - Excel");
  });

  it("picks the next free SheetN name", () => {
    start(workbook("Sheet1", "Sheet2"));
    expect(tabs()).toEqual(["Sheet1", "Sheet2", "Sheet3"]);
  });

  it("falls back to a blank Sheet1 without an imported workbook", () => {
    start(null);
    expect(tabs()).toEqual(["Sheet1", "Sheet2"]);
  });

  it("toggles between forum and the last workbook sheet with the boss key", async () => {
    start();
    send({ type: "page", requestId: 1, url: "https://www.chiphell.com/forum.php", page: forumIndex, append: false, canBack: false });
    await vi.waitFor(() => expect(root.textContent).toContain("自由水世界2024"));
    press({ code: "Digit1", altKey: true });
    expect(app.mode).toBe("forum");
    expect(activeTab()).toBe("Sheet2");
    expect(sessionStorage.getItem("omchh-excel-forum")).toBe("1");
    press({ code: "Digit1", altKey: true });
    expect(app.mode).toBe("workbook");
    expect(activeTab()).toBe("对账明细");
  });

  it("starts on the forum sheet when this tab already entered it", () => {
    sessionStorage.setItem("omchh-excel-forum", "1");
    start();
    expect(app.mode).toBe("forum");
  });

  it("asks the host to navigate when a forum row is activated", async () => {
    start();
    send({ type: "page", requestId: 1, url: "https://www.chiphell.com/forum.php", page: forumIndex, append: false, canBack: false });
    await vi.waitFor(() => expect(root.textContent).toContain("自由水世界2024"));
    root.querySelector(".xl-sheet-tab:last-of-type")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const cell = [...root.querySelectorAll<HTMLElement>("td[data-r]")].find((td) => td.textContent === "自由水世界2024")!;
    cell.click();
    cell.closest(".xl-grid")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(received).toContainEqual({ type: "navigate", url: "https://www.chiphell.com/forum-312-1.html", append: false }));
  });

  it("opens the comments pane and Review tab for thread details", async () => {
    start();
    const detail = parsePage(loadExcelFixture("thread-2904948"), "https://www.chiphell.com/thread-2904948-1-1.html");
    send({ type: "page", requestId: 2, url: "https://www.chiphell.com/thread-2904948-1-1.html", page: detail, append: false, canBack: false });
    await vi.waitFor(() => expect(root.querySelector(".xl-comments")).not.toBeNull());
    app.toggleBoss();
    expect(root.querySelector(".xl-tab.is-active")?.textContent).toBe("审阅");
  });

  it("explains an expired login in the status bar", async () => {
    start();
    send({ type: "page", requestId: 3, url: "https://www.chiphell.com/forum.php", page: { kind: "notice", reason: "login-required", message: "您需要先登录才能继续本操作" }, append: false, canBack: false });
    await vi.waitFor(() => expect(root.querySelector(".xl-status-text")?.textContent).toContain("需要重新登录"));
  });

  it("searches through the Find dialog", async () => {
    start();
    press({ code: "KeyF", key: "f", ctrlKey: true });
    const input = root.querySelector<HTMLInputElement>(".xl-dialog input")!;
    input.value = "5090";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(received).toContainEqual({
      type: "navigate", url: "https://www.chiphell.com/search.php?mod=forum&srchtxt=5090&searchsubmit=yes", append: false
    }));
    expect(app.mode).toBe("forum");
  });

  it("asks for the next page near the end of a thread list", async () => {
    start();
    const list = parsePage(loadExcelFixture("thread-list"), "https://www.chiphell.com/forum-283-1.html");
    send({ type: "page", requestId: 4, url: "https://www.chiphell.com/forum-283-1.html", page: list, append: false, canBack: false });
    await vi.waitFor(() => expect(root.textContent).toContain("大恶魔的Blog"));
    root.querySelector(".xl-forum .xl-grid")!.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(received).toContainEqual({ type: "navigate", url: "https://www.chiphell.com/forum-283-2.html", append: true }));
  });
});
