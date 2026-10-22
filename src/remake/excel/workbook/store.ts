// 导入工作簿的本机存储：只在扩展页面（iframe / 导入页 / 弹窗）调用，content script 永不读取
import { EXCEL_WORKBOOK_KEY } from "../prefs";
import { serializeWorkbook, type WorkbookModel } from "./model";

/** 工作簿摘要：弹窗只显示文件名与工作表数，不必把整个（最大 8MB 的）工作簿读进来 */
export const EXCEL_WORKBOOK_INFO_KEY = "omchhExcel:workbookInfo";

export interface WorkbookInfo { fileName: string; sheetCount: number; importedAt: string; truncated: boolean }

function summarize(model: WorkbookModel): WorkbookInfo {
  return {
    fileName: model.fileName,
    sheetCount: model.sheets.length,
    importedAt: model.importedAt,
    truncated: model.sheets.some((sheet) => sheet.truncated)
  };
}

function area(): chrome.storage.StorageArea | undefined {
  try {
    return globalThis.chrome?.storage?.local;
  } catch {
    return undefined;
  }
}

export async function saveWorkbook(model: WorkbookModel): Promise<void> {
  // 先做体积检查：超限直接抛 WorkbookTooLargeError，避免写入一半撞配额
  serializeWorkbook(model);
  await area()?.set({ [EXCEL_WORKBOOK_KEY]: model, [EXCEL_WORKBOOK_INFO_KEY]: summarize(model) });
}

function isWorkbookModel(value: unknown): value is WorkbookModel {
  const model = value as WorkbookModel | undefined;
  return Boolean(model && model.version === 1 && Array.isArray(model.sheets) && Array.isArray(model.styles));
}

export async function loadWorkbook(): Promise<WorkbookModel | null> {
  const storage = area();
  if (!storage) return null;
  try {
    const values = await storage.get(EXCEL_WORKBOOK_KEY);
    const stored = values[EXCEL_WORKBOOK_KEY];
    return isWorkbookModel(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function loadWorkbookInfo(): Promise<WorkbookInfo | null> {
  const storage = area();
  if (!storage) return null;
  try {
    const values = await storage.get(EXCEL_WORKBOOK_INFO_KEY);
    const info = values[EXCEL_WORKBOOK_INFO_KEY] as WorkbookInfo | undefined;
    if (info && typeof info.fileName === "string") return info;
  } catch {
    return null;
  }
  // 摘要出现之前导入的工作簿：退回读取整个工作簿算一次
  const model = await loadWorkbook();
  return model ? summarize(model) : null;
}

export async function deleteWorkbook(): Promise<void> {
  await area()?.remove([EXCEL_WORKBOOK_KEY, EXCEL_WORKBOOK_INFO_KEY]);
}
