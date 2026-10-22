// 全屏 iframe：承载扩展源的 Excel 应用；加载完成后经私有 MessageChannel 端口握手
import { APP_CONNECT } from "../protocol";

export function mountAppFrame(doc: Document, appUrl: string): { frame: HTMLIFrameElement; port: Promise<MessagePort> } {
  const frame = doc.createElement("iframe");
  frame.src = appUrl;
  frame.title = "Excel";
  frame.setAttribute("allow", "");
  Object.assign(frame.style, {
    position: "fixed", inset: "0", width: "100vw", height: "100vh",
    border: "0", margin: "0", padding: "0", background: "#fff", zIndex: "2147483647"
  });
  const port = new Promise<MessagePort>((resolve) => {
    frame.addEventListener("load", () => {
      const channel = new MessageChannel();
      frame.contentWindow?.postMessage(APP_CONNECT, new URL(appUrl).origin, [channel.port2]);
      resolve(channel.port1);
    }, { once: true });
  });
  doc.documentElement.append(frame);
  return { frame, port };
}
