// 弹窗数据层：皮肤设置（chrome.storage.sync）、Excel 偏好与工作簿摘要（local）、调试日志
import { clearMonitoringLog, exportMonitoringLogText, getMonitoringLogSummary } from "../monitoring-log";
import { LEGACY_SETTINGS_KEYS, type OmchhSettings } from "../schema";

export { loadSettings } from "../settings";
export { loadExcelPrefs, saveExcelPrefs, type ExcelPrefs } from "../../remake/excel/prefs";
export { loadWorkbookInfo, type WorkbookInfo } from "../../remake/excel/workbook/store";

/** 保存皮肤设置，并顺手清掉旧版本留下的主题 / 玻璃 / 动效等设置项 */
export async function saveSettings(settings: OmchhSettings): Promise<void> {
  const sync = globalThis.chrome?.storage?.sync;
  if (!sync) return;
  await sync.set({ ...settings });
  await sync.remove([...LEGACY_SETTINGS_KEYS]);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KiB`;
  return `${bytes} B`;
}

export async function monitoringStatusText(): Promise<string> {
  const summary = await getMonitoringLogSummary();
  // 空日志导出也有几十字节的外壳，显示字节数没有意义
  return summary.entryCount ? `${summary.entryCount} 条 · ${formatBytes(summary.byteLength)}` : "0 条";
}

export async function exportMonitoringLog(): Promise<void> {
  const text = await exportMonitoringLogText();
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `oh-my-chh-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function clearMonitoring(): Promise<void> {
  return clearMonitoringLog();
}
