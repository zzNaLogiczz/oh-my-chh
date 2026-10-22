// content script（宿主）⇄ iframe（Excel 应用）通信协议，经 MessageChannel 私有端口传输
import type { ExcelPage, FloorReplyMode } from "./model";

/** iframe 只接受第一条携带端口的握手消息 */
export const APP_CONNECT = "omchh-excel:connect";

export type HotkeyAction = "boss" | "images";

/** 回帖：floor 为空时回复楼主（快速回复框），否则答复指定楼层 */
export interface ReplyRequest {
  tid: string; fid: string; formhash: string; message: string;
  floor: { pid: string; mode: FloorReplyMode } | null;
}
/** message：服务器原话；pid：新回帖的 pid，服务器没给（如需审核）时为 null */
export interface ReplyOutcome { ok: boolean; message: string; pid: string | null }

export type HostToApp =
  | { type: "loading"; requestId: number; url: string }
  | { type: "page"; requestId: number; url: string; page: ExcelPage; append: boolean; canBack: boolean }
  | { type: "error"; requestId: number; url: string; message: string }
  | { type: "hotkey"; action: HotkeyAction }
  | { type: "reply-result"; replyId: number; outcome: ReplyOutcome };

export type AppToHost =
  | { type: "ready" }
  | { type: "navigate"; url: string; append: boolean }
  | { type: "back" }
  | { type: "open-original"; url: string }
  | { type: "reply"; replyId: number; request: ReplyRequest };
