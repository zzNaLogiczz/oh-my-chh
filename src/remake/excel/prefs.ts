// Excel 伪装模式的本机偏好：显示文件名、快捷键、图片默认显示（chrome.storage.local，不同步）

export interface ExcelPrefs {
  displayName: string;
  bossKey: string;
  imagesKey: string;
  imagesDefault: "show" | "hide";
}

export const EXCEL_PREFS_KEY = "omchhExcel:prefs";
export const EXCEL_WORKBOOK_KEY = "omchhExcel:workbook";

export const DEFAULT_EXCEL_PREFS: ExcelPrefs = {
  displayName: "工作簿1.xlsx",
  bossKey: "Alt+Digit1",
  imagesKey: "Alt+Digit2",
  imagesDefault: "show"
};

const MAX_DISPLAY_NAME = 120;

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeExcelPrefs(raw: unknown): ExcelPrefs {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    displayName: nonEmptyString(input.displayName, DEFAULT_EXCEL_PREFS.displayName).slice(0, MAX_DISPLAY_NAME),
    bossKey: nonEmptyString(input.bossKey, DEFAULT_EXCEL_PREFS.bossKey),
    imagesKey: nonEmptyString(input.imagesKey, DEFAULT_EXCEL_PREFS.imagesKey),
    imagesDefault: input.imagesDefault === "hide" ? "hide" : "show"
  };
}

export function excelWindowTitle(prefs: ExcelPrefs): string {
  return `${prefs.displayName} - Excel`;
}

function localStorageArea(): chrome.storage.StorageArea | undefined {
  try {
    return globalThis.chrome?.storage?.local;
  } catch {
    return undefined;
  }
}

export async function loadExcelPrefs(): Promise<ExcelPrefs> {
  const area = localStorageArea();
  if (!area) return DEFAULT_EXCEL_PREFS;
  try {
    const values = await area.get(EXCEL_PREFS_KEY);
    return normalizeExcelPrefs(values[EXCEL_PREFS_KEY]);
  } catch {
    // 存储读取失败时退回默认值，保证外壳仍能显示
    return DEFAULT_EXCEL_PREFS;
  }
}

export async function saveExcelPrefs(prefs: ExcelPrefs): Promise<void> {
  const area = localStorageArea();
  if (!area) return;
  await area.set({ [EXCEL_PREFS_KEY]: normalizeExcelPrefs(prefs) });
}
