// @vitest-environment node
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME_PALETTE, applyTint, parseThemePalette, resolveColor } from "../../src/remake/excel/workbook/colors";
import { normalizeWorkbook } from "../../src/remake/excel/workbook/normalize";
import { MAX_ROWS, WorkbookTooLargeError, serializeWorkbook, type WbSheet, type WorkbookModel } from "../../src/remake/excel/workbook/model";
import { EXCEL_WORKBOOK_INFO_KEY, deleteWorkbook, loadWorkbook, loadWorkbookInfo, saveWorkbook } from "../../src/remake/excel/workbook/store";
import { EXCEL_WORKBOOK_KEY } from "../../src/remake/excel/prefs";

async function roundTrip(build: (wb: ExcelJS.Workbook) => void): Promise<ExcelJS.Workbook> {
  const source = new ExcelJS.Workbook();
  build(source);
  const buffer = await source.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  return loaded;
}

function channelDistance(a: string, b: string): number {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [parse(a), parse(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}

const cellAt = (sheet: WbSheet, r: number, c: number) => sheet.cells.find((cell) => cell.r === r && cell.c === c);

describe("theme colors", () => {
  it("maps theme indexes to Office defaults with bg/text swap", () => {
    expect(resolveColor({ theme: 1 }, DEFAULT_THEME_PALETTE)).toBe("#000000");
    expect(resolveColor({ theme: 0 }, DEFAULT_THEME_PALETTE)).toBe("#ffffff");
    expect(resolveColor({ theme: 4 }, DEFAULT_THEME_PALETTE)).toBe("#4472c4");
  });

  it("applies tint like Excel's lighter/darker variants", () => {
    const lighter = resolveColor({ theme: 4, tint: 0.3999 }, DEFAULT_THEME_PALETTE)!;
    expect(channelDistance(lighter, "#8eaadb")).toBeLessThanOrEqual(2);
    expect(channelDistance(applyTint("#4472c4", -0.25), "#2f5597")).toBeLessThanOrEqual(2);
  });

  it("drops alpha from argb and resolves indexed colors", () => {
    expect(resolveColor({ argb: "FFFFC000" }, DEFAULT_THEME_PALETTE)).toBe("#ffc000");
    expect(resolveColor({ indexed: 10 }, DEFAULT_THEME_PALETTE)).toBe("#ff0000");
    expect(resolveColor(undefined, DEFAULT_THEME_PALETTE)).toBeNull();
  });

  it("reads a theme palette from theme XML in index order", () => {
    const xml = `<a:clrScheme name="X"><a:dk1><a:sysClr val="windowText" lastClr="111111"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="EEEEEE"/></a:lt1>
      <a:dk2><a:srgbClr val="222222"/></a:dk2><a:lt2><a:srgbClr val="DDDDDD"/></a:lt2><a:accent1><a:srgbClr val="123456"/></a:accent1></a:clrScheme>`;
    const palette = parseThemePalette(xml);
    expect(palette.slice(0, 5)).toEqual(["EEEEEE", "111111", "DDDDDD", "222222", "123456"]);
    expect(palette[5]).toBe(DEFAULT_THEME_PALETTE[5]);
    expect(parseThemePalette(undefined)).toEqual(DEFAULT_THEME_PALETTE);
  });
});

describe("normalizeWorkbook", () => {
  it("keeps merges, formats, formulas, fills, fonts and sizes", async () => {
    const wb = await roundTrip((book) => {
      const ws = book.addWorksheet("对账明细");
      ws.mergeCells("A1:C1");
      ws.getCell("A1").value = "季度对账";
      ws.getCell("B2").value = 1234.5;
      ws.getCell("B2").numFmt = "#,##0.00";
      ws.getCell("C2").value = new Date(Date.UTC(2026, 9, 21));
      ws.getCell("C2").numFmt = "yyyy/mm/dd";
      ws.getCell("A3").value = 10;
      ws.getCell("B3").value = 20;
      ws.getCell("C3").value = { formula: "SUM(A3:B3)", result: 30 };
      ws.getCell("A4").value = "逾期";
      ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
      ws.getCell("A4").font = { bold: true, color: { argb: "FFFF0000" } };
      ws.getCell("B4").value = "逾期";
      ws.getCell("B4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
      ws.getCell("B4").font = { bold: true, color: { argb: "FFFF0000" } };
      ws.getColumn(1).width = 20;
      ws.getRow(5).height = 30;
      ws.getCell("A5").value = "x";
      book.addWorksheet("汇总").getCell("A1").value = "总计";
    });
    const model = normalizeWorkbook(wb, "Q4 对账.xlsx");

    expect(model.version).toBe(1);
    expect(model.fileName).toBe("Q4 对账.xlsx");
    expect(model.sheets.map((s) => s.name)).toEqual(["对账明细", "汇总"]);
    const sheet = model.sheets[0];
    expect(sheet.merges).toContainEqual({ r1: 0, c1: 0, r2: 0, c2: 2 });
    expect(cellAt(sheet, 0, 0)?.text).toBe("季度对账");
    expect(cellAt(sheet, 0, 1)).toBeUndefined();
    expect(cellAt(sheet, 1, 1)?.text).toBe("1,234.50");
    expect(cellAt(sheet, 1, 2)?.text).toBe("2026/10/21");
    expect(cellAt(sheet, 2, 2)).toMatchObject({ text: "30", formula: "=SUM(A3:B3)" });

    const a4 = cellAt(sheet, 3, 0)!;
    const b4 = cellAt(sheet, 3, 1)!;
    expect(model.styles[a4.s!]).toMatchObject({ fill: "#ffc000", bold: true, color: "#ff0000" });
    expect(a4.s).toBe(b4.s);
    expect(model.styles[cellAt(sheet, 1, 1)!.s!].hAlign).toBe("right");

    expect(sheet.colWidths[0]).toBe(145);
    expect(sheet.rowHeights[4]).toBe(40);
    expect(sheet.truncated).toBe(false);
  });

  it("truncates sheets beyond the row limit", async () => {
    const wb = await roundTrip((book) => {
      const ws = book.addWorksheet("导出");
      for (let r = 1; r <= 1200; r += 1) ws.addRow([r, "a", "b", "c", "d"]);
    });
    const sheet = normalizeWorkbook(wb, "big.xlsx").sheets[0];
    expect(sheet.rowCount).toBe(MAX_ROWS);
    expect(sheet.truncated).toBe(true);
    expect(sheet.cells.every((cell) => cell.r < MAX_ROWS)).toBe(true);
  });

  it("refuses to serialize models over the byte budget", () => {
    const huge: WorkbookModel = {
      version: 1, fileName: "x.xlsx", importedAt: "2026-10-21T00:00:00.000Z", styles: [], activeSheet: 0,
      sheets: [{ name: "S", rowCount: 1, colCount: 1, colWidths: [64], rowHeights: [20], merges: [], frozenRows: 0, frozenCols: 0, truncated: false,
        cells: [{ r: 0, c: 0, text: "x".repeat(8_000_001) }] }]
    };
    expect(() => serializeWorkbook(huge)).toThrow(WorkbookTooLargeError);
  });
});

describe("workbook store", () => {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (items: Record<string, unknown>) => Object.assign(store, items),
        remove: async (keys: string | string[]) => { for (const key of [keys].flat()) delete store[key]; }
      }
    }
  };
  afterEach(() => { for (const key of Object.keys(store)) delete store[key]; });

  const tiny: WorkbookModel = {
    version: 1, fileName: "t.xlsx", importedAt: "2026-10-21T00:00:00.000Z", styles: [], activeSheet: 0,
    sheets: [{ name: "S", rowCount: 1, colCount: 1, colWidths: [64], rowHeights: [20], merges: [], frozenRows: 0, frozenCols: 0, truncated: false, cells: [] }]
  };

  it("saves, loads and deletes the workbook under one key", async () => {
    await saveWorkbook(tiny);
    expect(store[EXCEL_WORKBOOK_KEY]).toBeDefined();
    await expect(loadWorkbook()).resolves.toEqual(tiny);
    await deleteWorkbook();
    await expect(loadWorkbook()).resolves.toBeNull();
  });

  it("keeps a small summary next to the workbook so the popup never loads the whole file", async () => {
    await saveWorkbook({ ...tiny, sheets: [tiny.sheets[0], { ...tiny.sheets[0], name: "T", truncated: true }] });
    expect(store[EXCEL_WORKBOOK_INFO_KEY]).toEqual({ fileName: "t.xlsx", sheetCount: 2, importedAt: tiny.importedAt, truncated: true });
    await expect(loadWorkbookInfo()).resolves.toEqual({ fileName: "t.xlsx", sheetCount: 2, importedAt: tiny.importedAt, truncated: true });
    await deleteWorkbook();
    expect(store[EXCEL_WORKBOOK_INFO_KEY]).toBeUndefined();
    await expect(loadWorkbookInfo()).resolves.toBeNull();
  });

  it("derives the summary from workbooks imported before summaries existed", async () => {
    store[EXCEL_WORKBOOK_KEY] = tiny;
    await expect(loadWorkbookInfo()).resolves.toEqual({ fileName: "t.xlsx", sheetCount: 1, importedAt: tiny.importedAt, truncated: false });
  });

  it("ignores stored data from another model version", async () => {
    store[EXCEL_WORKBOOK_KEY] = { ...tiny, version: 99 };
    await expect(loadWorkbook()).resolves.toBeNull();
  });
});
