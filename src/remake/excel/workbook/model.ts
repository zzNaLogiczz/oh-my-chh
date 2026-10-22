// 导入工作簿的规范化模型：导入时一次性解析，老板键视图只读此模型渲染（存 chrome.storage.local）

export interface CellStyle {
  fontFamily?: string; fontSize?: number;
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  color?: string; fill?: string;
  hAlign?: "left" | "center" | "right"; vAlign?: "top" | "middle" | "bottom"; wrap?: boolean;
  borderTop?: string; borderRight?: string; borderBottom?: string; borderLeft?: string;
}

/** r/c 从 0 起；s 为 WorkbookModel.styles 下标 */
export interface WbCell { r: number; c: number; text: string; formula?: string; s?: number }
export interface WbMerge { r1: number; c1: number; r2: number; c2: number }

export interface WbSheet {
  name: string; rowCount: number; colCount: number;
  colWidths: number[]; rowHeights: number[];
  cells: WbCell[]; merges: WbMerge[];
  frozenRows: number; frozenCols: number;
  truncated: boolean;
}

export interface WorkbookModel {
  version: 1; fileName: string; importedAt: string;
  styles: CellStyle[]; sheets: WbSheet[]; activeSheet: number;
}

export const MAX_ROWS = 1000;
export const MAX_COLS = 100;
export const MAX_BYTES = 8_000_000;

export class WorkbookTooLargeError extends Error {
  constructor(bytes: number) {
    super(`工作簿解析后约 ${(bytes / 1_000_000).toFixed(1)}MB，超过 ${MAX_BYTES / 1_000_000}MB 上限`);
    this.name = "WorkbookTooLargeError";
  }
}

/** 存储前的体积检查：超限抛 WorkbookTooLargeError（放在这里而不是 normalize，免得读取方带上 ssf） */
export function serializeWorkbook(model: WorkbookModel): string {
  const json = JSON.stringify(model);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > MAX_BYTES) throw new WorkbookTooLargeError(bytes);
  return json;
}
