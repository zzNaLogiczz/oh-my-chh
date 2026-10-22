// iframe 入口：等待宿主握手拿到私有端口，再读取本机偏好与工作簿启动 Excel 应用
import { loadExcelPrefs } from "../prefs";
import { APP_CONNECT } from "../protocol";
import { loadWorkbook } from "../workbook/store";
import { createExcelApp } from "./app";

let connected = false;

window.addEventListener("message", (event: MessageEvent) => {
  // 只认第一条握手：之后页面脚本再发的消息一律忽略
  if (connected || event.data !== APP_CONNECT || event.ports.length !== 1) return;
  connected = true;
  const port = event.ports[0];
  void (async () => {
    const [prefs, workbook] = await Promise.all([loadExcelPrefs(), loadWorkbook()]);
    const root = document.getElementById("root");
    if (!root) return;
    createExcelApp(root, {
      port,
      prefs,
      workbook,
      openOptions: () => { void chrome.runtime.openOptionsPage(); }
    });
    port.postMessage({ type: "ready" });
  })();
});
