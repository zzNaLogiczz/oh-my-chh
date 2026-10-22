import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountOptionsPage } from "../../src/remake/excel/options/options";
import { EXCEL_PREFS_KEY, EXCEL_WORKBOOK_KEY } from "../../src/remake/excel/prefs";
import type { WorkbookModel } from "../../src/remake/excel/workbook/model";

let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  document.body.innerHTML = '<div id="root"></div>';
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (items: Record<string, unknown>) => Object.assign(store, items),
        remove: async (keys: string | string[]) => { for (const key of [keys].flat()) delete store[key]; }
      }
    }
  };
});

async function sampleXlsx(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("对账明细").getCell("A1").value = "供应商";
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** 关系目标 → 包内绝对路径（rels 文件所在部件的目录为基准） */
function absoluteTarget(relsPath: string, target: string): string {
  const dir = relsPath.split("/").slice(0, -2);
  const parts = [...dir];
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return `/${parts.join("/")}`;
}

/**
 * 改写成 .NET Open XML SDK 一类生成器的写法（Excel 都能正常打开，exceljs 直接读会崩）：
 * - prefix：SpreadsheetML 元素全带 x: 前缀（<x:workbook>），exceljs 报 “reading 'sheets'”
 * - absolute：关系目标写成包内绝对路径（/xl/tables/table1.xml），exceljs 找不到表格部件
 */
async function asOpenXmlSdk(buffer: ArrayBuffer, { prefix = false, absolute = false }): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    let xml = await entry.async("string");
    if (prefix && entry.name.startsWith("xl/") && entry.name.endsWith(".xml") && xml.includes(`xmlns="${MAIN_NS}"`)) {
      xml = xml
        .replace(/<(\/?)(?![?!])([A-Za-z][\w.-]*)(?=[\s/>])/g, (tag, slash, name) => (name.includes(":") ? tag : `<${slash}x:${name}`))
        .replace(`xmlns="${MAIN_NS}"`, `xmlns:x="${MAIN_NS}"`);
    }
    if (absolute && entry.name.endsWith(".rels")) {
      xml = xml.replace(/<Relationship\b[^>]*>/g, (tag) => (tag.includes('TargetMode="External"') ? tag
        : tag.replace(/\bTarget="([^"]*)"/, (_, target: string) => `Target="${absoluteTarget(entry.name, target)}"`)));
    }
    zip.file(entry.name, xml);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

function chooseFile(name: string): void {
  const input = document.querySelector<HTMLInputElement>("#excel-file")!;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], name)] });
  input.dispatchEvent(new Event("change"));
}

const root = () => document.querySelector<HTMLElement>("#root")!;
const status = () => document.querySelector("#status")!.textContent ?? "";

describe("excel options page", () => {
  it("imports a workbook and uses its real file name as the window title", async () => {
    const buffer = await sampleXlsx();
    await mountOptionsPage(root(), { readFile: async () => buffer });
    chooseFile("2026Q4 供应商对账.xlsx");
    await vi.waitFor(() => expect(store[EXCEL_WORKBOOK_KEY]).toBeDefined());
    expect((store[EXCEL_WORKBOOK_KEY] as WorkbookModel).sheets[0].name).toBe("对账明细");
    await vi.waitFor(() => expect(store[EXCEL_PREFS_KEY]).toMatchObject({ displayName: "2026Q4 供应商对账.xlsx" }));
    expect(document.querySelector("#workbook-name")!.textContent).toBe("2026Q4 供应商对账.xlsx");
  });

  it("reads workbooks whose XML puts a namespace prefix on every element", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("报价单");
    sheet.getCell("A1").value = "产品";
    sheet.getCell("B2").value = 1280;
    sheet.mergeCells("A3:B3");
    const prefixed = await asOpenXmlSdk((await wb.xlsx.writeBuffer()) as ArrayBuffer, { prefix: true });
    expect(new TextDecoder().decode(await (await JSZip.loadAsync(prefixed)).file("xl/workbook.xml")!.async("uint8array"))).toContain("<x:workbook");
    await mountOptionsPage(root(), { readFile: async () => prefixed });
    chooseFile("产品报价单.xlsx");
    await vi.waitFor(() => expect(status()).not.toMatch(/^正在读取/), { timeout: 3000 });
    expect(status()).toBe("已导入 产品报价单.xlsx");
    const [parsed] = (store[EXCEL_WORKBOOK_KEY] as WorkbookModel).sheets;
    expect(parsed.name).toBe("报价单");
    expect(parsed.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ r: 0, c: 0, text: "产品" }),
      expect.objectContaining({ r: 1, c: 1, text: "1280" })
    ]));
    expect(parsed.merges).toEqual([{ r1: 2, c1: 0, r2: 2, c2: 1 }]);
  });

  it("reads workbooks whose relationships use absolute paths, tables included", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("报价单");
    sheet.addTable({ name: "Quote", ref: "A1", headerRow: true, columns: [{ name: "产品" }, { name: "数量" }], rows: [["演示品", 3]] });
    const converted = await asOpenXmlSdk((await wb.xlsx.writeBuffer()) as ArrayBuffer, { prefix: true, absolute: true });
    const rels = await (await JSZip.loadAsync(converted)).file("xl/worksheets/_rels/sheet1.xml.rels")!.async("string");
    expect(rels).toContain('Target="/xl/tables/');
    await mountOptionsPage(root(), { readFile: async () => converted });
    chooseFile("产品报价单.xlsx");
    await vi.waitFor(() => expect(status()).not.toMatch(/^正在读取/), { timeout: 3000 });
    expect(status()).toBe("已导入 产品报价单.xlsx");
    const [parsed] = (store[EXCEL_WORKBOOK_KEY] as WorkbookModel).sheets;
    expect(parsed.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ r: 0, c: 0, text: "产品" }),
      expect.objectContaining({ r: 1, c: 1, text: "3" })
    ]));
  });

  it("says in Chinese that the file has an unsupported format when it cannot be parsed", async () => {
    // 根元素认不出来：exceljs 会抛 “Cannot read properties of undefined (reading 'sheets')”，用户不该看到这种英文
    const zip = await JSZip.loadAsync(await sampleXlsx());
    zip.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><unknown xmlns="urn:example"/>');
    const broken = await zip.generateAsync({ type: "arraybuffer" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mountOptionsPage(root(), { readFile: async () => broken });
    chooseFile("复杂格式.xlsx");
    await vi.waitFor(() => expect(status()).not.toMatch(/^正在读取/), { timeout: 3000 });
    expect(status()).toBe("文件含有不支持的格式，请不要上传包含复杂格式的 Excel");
    expect(document.querySelector("#status")!.classList.contains("is-error")).toBe(true);
    expect(store[EXCEL_WORKBOOK_KEY]).toBeUndefined();
    // 技术原因只留给排查用
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("asks for an .xlsx when the file is not one at all", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const docx = new JSZip();
    docx.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    const files: Array<[string, ArrayBuffer]> = [
      ["报价单.csv", new TextEncoder().encode("序号,产品\n1,笔记本").buffer as ArrayBuffer],
      ["改了后缀.xlsx", await docx.generateAsync({ type: "arraybuffer" })]
    ];
    for (const [name, buffer] of files) {
      await mountOptionsPage(root(), { readFile: async () => buffer });
      chooseFile(name);
      await vi.waitFor(() => expect(status()).not.toMatch(/^正在读取/), { timeout: 3000 });
      expect(status()).toBe("这不是 .xlsx 文件，请在 Excel 中另存为 .xlsx 后再导入");
    }
    expect(store[EXCEL_WORKBOOK_KEY]).toBeUndefined();
    warn.mockRestore();
  });

  it("asks to retry when the file itself cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mountOptionsPage(root(), { readFile: async () => { throw new DOMException("The requested file could not be read", "NotReadableError"); } });
    chooseFile("已被移动.xlsx");
    await vi.waitFor(() => expect(status()).not.toMatch(/^正在读取/), { timeout: 3000 });
    expect(status()).toBe("无法读取该文件，请重试");
    warn.mockRestore();
  });

  it("does not blame the file when saving fails", async () => {
    const buffer = await sampleXlsx();
    const local = (globalThis as unknown as { chrome: { storage: { local: { set: unknown } } } }).chrome.storage.local;
    local.set = async () => { throw new Error("QUOTA_BYTES quota exceeded"); };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mountOptionsPage(root(), { readFile: async () => buffer });
    chooseFile("正常.xlsx");
    await vi.waitFor(() => expect(status()).not.toMatch(/^正在读取/), { timeout: 3000 });
    expect(status()).toBe("保存失败，请重试");
    warn.mockRestore();
  });

  it("accepts a workbook dropped onto the drop zone", async () => {
    const buffer = await sampleXlsx();
    await mountOptionsPage(root(), { readFile: async () => buffer });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [new File(["x"], "拖进来.xlsx")] } });
    document.querySelector("#drop-zone")!.dispatchEvent(drop);
    await vi.waitFor(() => expect(store[EXCEL_PREFS_KEY]).toMatchObject({ displayName: "拖进来.xlsx" }));
  });

  it("uses the extension's own icon in the header", async () => {
    await mountOptionsPage(root());
    expect(document.querySelector<HTMLImageElement>("img.opt-logo")?.getAttribute("src")).toBe("../icons/chh-icon-48.png");
  });

  it("only manages the workbook: shortcuts and display settings live in the popup", async () => {
    await mountOptionsPage(root());
    expect(document.querySelector("#boss-key")).toBeNull();
    expect(document.querySelector("#display-name")).toBeNull();
    expect(document.querySelector("#images-default")).toBeNull();
  });

  it("deletes the stored workbook", async () => {
    store[EXCEL_WORKBOOK_KEY] = { version: 1, fileName: "a.xlsx", importedAt: "2026-10-21T00:00:00.000Z", styles: [], sheets: [], activeSheet: 0 };
    await mountOptionsPage(root());
    document.querySelector<HTMLButtonElement>("#delete-workbook")!.click();
    await vi.waitFor(() => expect(store[EXCEL_WORKBOOK_KEY]).toBeUndefined());
  });

  it("explains oversized files instead of failing silently", async () => {
    const huge: WorkbookModel = {
      version: 1, fileName: "big.xlsx", importedAt: "2026-10-21T00:00:00.000Z", styles: [], activeSheet: 0,
      sheets: [{ name: "S", rowCount: 1, colCount: 1, colWidths: [64], rowHeights: [20], merges: [], frozenRows: 0, frozenCols: 0, truncated: false,
        cells: [{ r: 0, c: 0, text: "x".repeat(8_000_001) }] }]
    };
    await mountOptionsPage(root(), { readFile: async () => new ArrayBuffer(1), loadWorkbookFile: async () => huge });
    chooseFile("big.xlsx");
    await vi.waitFor(() => expect(status()).toContain("文件过大"));
    expect(store[EXCEL_WORKBOOK_KEY]).toBeUndefined();
  });
});
