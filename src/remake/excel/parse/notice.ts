// Discuz 提示页（showmessage）：登录墙、搜索频率限制、权限不足等
import type { NoticePage } from "../model";
import { text } from "./common";

export function detectNotice(doc: Document): NoticePage | null {
  const box = doc.querySelector("#messagetext");
  if (!box) return null;
  // 只取正文段落，避开“如果您的浏览器没有自动跳转”这类附加链接
  const message = text(box.querySelector("p")) || text(box);
  if (/登录/.test(message)) return { kind: "notice", reason: "login-required", message };
  return { kind: "notice", reason: "message", message };
}
