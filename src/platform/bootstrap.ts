// 内容脚本入口：读取皮肤设置。原版皮肤不改动页面；Excel 伪装皮肤整页交给扩展 iframe 应用（原站一帧不露）
import { recordMonitoringEvent, setMonitoringEnabled } from "../preferences/monitoring-log";
import { loadSettings, onSettingsChanged } from "../preferences/settings";
import { consumeExcelBypass } from "../remake/excel/host/bypass";
import { startExcelHost } from "../remake/excel/host/controller";
import { warnForUnexpectedExtensionError } from "./extension-context";

const ALLOWED_HOST = "www.chiphell.com";

/** preflight.css 在 document_start 先隐藏 body；原版皮肤读完设置就放行 */
function markPaintReady(): void {
  document.documentElement.dataset.omchhPaintReady = "1";
}

function recordError(source: string, message: string, error: unknown): void {
  warnForUnexpectedExtensionError(`[oh-my-chh] ${message}`, error);
  void recordMonitoringEvent({ level: "error", source, message, fields: { error: error instanceof Error ? error.message : String(error) } });
}

async function initialize(): Promise<void> {
  if (window.location.hostname !== ALLOWED_HOST) {
    markPaintReady();
    return;
  }
  const settings = await loadSettings();
  setMonitoringEnabled(settings.debugLog);
  onSettingsChanged((next) => {
    setMonitoringEnabled(next.debugLog);
    // 换皮肤整页重载，由新皮肤重新接管；其他设置变化不打断当前页面
    if (next.skin !== settings.skin) window.location.reload();
  });

  // 「在浏览器中打开原网页」只对目标地址的下一次加载放行一次
  if (settings.skin === "excel" && !consumeExcelBypass(window.location.href)) {
    // Excel 接管失败时宁可保持遮罩也不露出原站
    await startExcelHost(window).catch((error: unknown) => recordError("excel", "Failed to start Excel skin", error));
    return;
  }
  markPaintReady();
}

void initialize().catch((error: unknown) => {
  recordError("initialize", "Failed to initialize content script; releasing first-paint guard.", error);
  markPaintReady();
});
