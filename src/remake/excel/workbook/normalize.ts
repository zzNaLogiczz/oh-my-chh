// exceljs 工作簿 → 规范化模型：值按数字格式渲染为文本、样式去重、合并/尺寸/冻结窗格保留，图表忽略
import type ExcelJS from "exceljs";
import * as SSF from "ssf";
import { parseThemePalette, resolveColor, type ExcelColor } from "./colors";
import {
  MAX_COLS, MAX_ROWS,
  type CellStyle, type WbCell, type WbMerge, type WbSheet, type WorkbookModel
} from "./model";

const DEFAULT_COL_PX = 64;
const DEFAULT_ROW_PX = 20;
const BORDER_CSS: Record<string, string> = {
  thin: "1px solid", hair: "1px solid", medium: "2px solid", thick: "3px solid",
  dashed: "1px dashed", mediumDashed: "2px dashed", dotted: "1px dotted", double: "3px double"
};

/** Excel 日期序列号（1900 系统）：exceljs 读出的日期为 UTC */
function excelSerial(date: Date): number {
  return date.getTime() / 86_400_000 + 25_569;
}

function formatScalar(value: unknown, numFmt: string | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const numeric = value instanceof Date ? excelSerial(value) : typeof value === "number" ? value : null;
  if (numeric === null) return String(value);
  try {
    return SSF.format(numFmt || (value instanceof Date ? "yyyy-mm-dd" : "General"), numeric);
  } catch {
    return String(value);
  }
}

/** 单元格显示文本：公式取缓存结果、富文本拼接、超链接取文字、错误值原样 */
function cellText(cell: ExcelJS.Cell): { text: string; formula?: string; numeric: boolean } {
  const value = cell.value as unknown;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const v = value as Record<string, unknown>;
    if ("formula" in v || "sharedFormula" in v) {
      const formula = cell.formula ? `=${cell.formula}` : undefined;
      const result = v.result as unknown;
      const errorText = result && typeof result === "object" ? String((result as { error?: string }).error ?? "") : null;
      return { text: errorText ?? formatScalar(result, cell.numFmt), formula, numeric: typeof result === "number" || result instanceof Date };
    }
    if (Array.isArray(v.richText)) return { text: (v.richText as { text: string }[]).map((part) => part.text).join(""), numeric: false };
    if ("text" in v) return { text: String(v.text ?? ""), numeric: false };
    if ("error" in v) return { text: String(v.error), numeric: false };
  }
  return { text: formatScalar(value, cell.numFmt), numeric: typeof value === "number" || value instanceof Date };
}

function borderCss(edge: Partial<ExcelJS.Border> | undefined, palette: string[]): string | undefined {
  if (!edge?.style) return undefined;
  const color = resolveColor(edge.color as ExcelColor | undefined, palette) ?? "#000000";
  return `${BORDER_CSS[edge.style] ?? "1px solid"} ${color}`;
}

function fillColor(fill: ExcelJS.Fill | undefined, palette: string[]): string | undefined {
  if (!fill) return undefined;
  if (fill.type === "pattern") return fill.pattern === "none" ? undefined : resolveColor(fill.fgColor as ExcelColor, palette) ?? undefined;
  if (fill.type === "gradient") return resolveColor(fill.stops?.[0]?.color as ExcelColor, palette) ?? undefined;
  return undefined;
}

const H_ALIGN: Record<string, CellStyle["hAlign"]> = { left: "left", center: "center", centerContinuous: "center", right: "right" };
const V_ALIGN: Record<string, CellStyle["vAlign"]> = { top: "top", middle: "middle", bottom: "bottom" };

function cellStyle(cell: ExcelJS.Cell, palette: string[], numeric: boolean): CellStyle {
  const font = cell.font ?? {};
  const alignment = cell.alignment ?? {};
  const border = cell.border ?? {};
  const style: CellStyle = {
    fontFamily: font.name, fontSize: font.size,
    bold: font.bold || undefined, italic: font.italic || undefined,
    underline: font.underline ? true : undefined, strike: font.strike || undefined,
    color: resolveColor(font.color as ExcelColor | undefined, palette) ?? undefined,
    fill: fillColor(cell.fill, palette),
    // Excel 常规对齐下数字/日期靠右
    hAlign: H_ALIGN[alignment.horizontal ?? ""] ?? (numeric ? "right" : undefined),
    vAlign: V_ALIGN[alignment.vertical ?? ""],
    wrap: alignment.wrapText || undefined,
    borderTop: borderCss(border.top, palette), borderRight: borderCss(border.right, palette),
    borderBottom: borderCss(border.bottom, palette), borderLeft: borderCss(border.left, palette)
  };
  for (const key of Object.keys(style) as (keyof CellStyle)[]) if (style[key] === undefined) delete style[key];
  return style;
}

/** 相同样式共享下标，压缩存储体积 */
function createStyleTable() {
  const styles: CellStyle[] = [];
  const index = new Map<string, number>();
  return {
    styles,
    intern(style: CellStyle): number {
      const key = JSON.stringify(style);
      let id = index.get(key);
      if (id === undefined) { id = styles.length; styles.push(style); index.set(key, id); }
      return id;
    }
  };
}

function decodeAddress(address: string): { r: number; c: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/)!;
  const c = [...match[1]].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return { r: Number(match[2]) - 1, c };
}

function sheetMerges(ws: ExcelJS.Worksheet, rowCount: number, colCount: number): WbMerge[] {
  const ranges = ((ws.model as unknown as { merges?: string[] }).merges ?? []);
  return ranges.flatMap((range) => {
    const [from, to] = range.split(":").map(decodeAddress);
    if (from.r >= rowCount || from.c >= colCount) return [];
    return [{ r1: from.r, c1: from.c, r2: Math.min(to.r, rowCount - 1), c2: Math.min(to.c, colCount - 1) }];
  });
}

function hasVisualStyle(style: CellStyle): boolean {
  return Boolean(style.fill || style.borderTop || style.borderRight || style.borderBottom || style.borderLeft);
}

function normalizeSheet(ws: ExcelJS.Worksheet, palette: string[], table: ReturnType<typeof createStyleTable>): WbSheet {
  const rowCount = Math.min(ws.rowCount, MAX_ROWS);
  const colCount = Math.min(ws.columnCount, MAX_COLS);
  const cells: WbCell[] = [];
  // 逐行读取（含仅有样式的空格子，保留色块与边框）；合并区域从属格不单独输出
  for (let r = 1; r <= rowCount; r += 1) {
    ws.findRow(r)?.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > colCount || (cell.isMerged && cell.master.address !== cell.address)) return;
      const { text, formula, numeric } = cellText(cell);
      const style = cellStyle(cell, palette, numeric);
      if (!text && !hasVisualStyle(style)) return;
      cells.push({ r: r - 1, c: c - 1, text, ...(formula ? { formula } : {}), s: table.intern(style) });
    });
  }
  const view = ws.views?.[0] as { state?: string; xSplit?: number; ySplit?: number } | undefined;
  const frozen = view?.state === "frozen";
  return {
    name: ws.name, rowCount, colCount, cells,
    colWidths: Array.from({ length: colCount }, (_, i) => {
      const column = ws.getColumn(i + 1);
      return column.hidden ? 0 : column.width ? Math.round(column.width * 7 + 5) : DEFAULT_COL_PX;
    }),
    rowHeights: Array.from({ length: rowCount }, (_, i) => {
      const row = ws.findRow(i + 1);
      return row?.hidden ? 0 : row?.height ? Math.round((row.height * 4) / 3) : DEFAULT_ROW_PX;
    }),
    merges: sheetMerges(ws, rowCount, colCount),
    frozenRows: frozen ? view?.ySplit ?? 0 : 0,
    frozenCols: frozen ? view?.xSplit ?? 0 : 0,
    truncated: ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS
  };
}

export function normalizeWorkbook(wb: ExcelJS.Workbook, fileName: string): WorkbookModel {
  const themes = (wb as unknown as { _themes?: Record<string, string> })._themes;
  const palette = parseThemePalette(themes?.theme1);
  const table = createStyleTable();
  // 隐藏工作表不展示，与 Excel 打开时一致
  const visible = wb.worksheets.filter((ws) => ws.state !== "hidden" && ws.state !== "veryHidden");
  const sheets = visible.map((ws) => normalizeSheet(ws, palette, table));
  const activeTab = (wb.views?.[0] as { activeTab?: number } | undefined)?.activeTab ?? 0;
  return {
    version: 1, fileName, importedAt: new Date().toISOString(),
    styles: table.styles, sheets,
    activeSheet: Math.min(Math.max(activeTab, 0), Math.max(sheets.length - 1, 0))
  };
}
