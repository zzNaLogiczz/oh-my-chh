// 回帖：同源提交 Discuz 回复表单（沿用当前标签页的登录会话），把服务器的 ajax 回执翻译成成功 / 失败
import type { ReplyOutcome, ReplyRequest } from "../protocol";

const ORIGIN = "https://www.chiphell.com";
// chh 开了 Discuz 的 ajax 校验：ajax GET 不带这个头会返回整页，而不是表单片段 / XML 回执
const AJAX_HEADERS = { "X-Requested-With": "XMLHttpRequest" };
const FALLBACK_FAILURE = "发布失败，请稍后重试。";
const JS_STRING = String.raw`'((?:\\.|[^'\\])*)'`;
const SUCCEED = new RegExp(String.raw`succeedhandle_\w+\(${JS_STRING}\s*,\s*${JS_STRING}\s*(?:,\s*(\{[^}]*\}))?`);
const ERROR = new RegExp(String.raw`errorhandle_\w+\(${JS_STRING}`);
const SKIPPED_INPUTS = new Set(["submit", "button", "image", "file", "reset"]);

const unescapeJs = (raw: string) => raw.replace(/\\(.)/g, "$1");
const cdata = (text: string) => text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? text;

/** 回执里没有回调脚本时（例如被重定向到登录页），取页面上的提示文字 */
function noticeText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // 提示框里除了提示语还有“如果浏览器没有自动跳转”之类的链接，优先只取提示语那一段
  const notice = doc.querySelector("#messagetext p, .alert_error p, .alert_info p, .alert_right p")
    ?? doc.querySelector(".alert_error, .alert_info, .alert_right");
  if (notice) return notice.textContent?.trim() ?? "";
  // 整页 HTML 的正文没有参考价值，只认 ajax 片段里的纯文字
  if (/<html[\s>]/i.test(html)) return "";
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  return (doc.body.textContent ?? "").trim().slice(0, 200);
}

/** Discuz ajax 回执：成功调用 succeedhandle_xxx(跳转地址, 提示, 参数)，失败调用 errorhandle_xxx(提示, 参数) */
export function parseReplyResponse(text: string): ReplyOutcome {
  const body = cdata(text);
  const succeed = body.match(SUCCEED);
  if (succeed) {
    const pid = succeed[3]?.match(/'pid'\s*:\s*'(\d+)'/)?.[1] ?? succeed[1].match(/[?&]pid=(\d+)/)?.[1] ?? null;
    return { ok: true, message: unescapeJs(succeed[2]), pid };
  }
  const error = body.match(ERROR);
  if (error) return { ok: false, message: unescapeJs(error[1]), pid: null };
  const notice = noticeText(body);
  // 没有回调脚本但提示说成功了：按成功报告，免得用户以为失败又发一遍
  if (notice.includes("成功")) return { ok: true, message: notice, pid: body.match(/[?&;]pid=(\d+)/)?.[1] ?? null };
  return { ok: false, message: notice || FALLBACK_FAILURE, pid: null };
}

function assertRequest(request: ReplyRequest): void {
  // 这些值会拼进请求地址，只接受纯数字 / 纯字母数字，防止被拼出别的参数
  const ids = [request.tid, request.fid, ...(request.floor ? [request.floor.pid] : [])];
  if (!ids.every((id) => /^\d+$/.test(id)) || !/^\w+$/.test(request.formhash)) throw new Error("invalid reply request");
}

function forumUrl(params: Record<string, string>): string {
  return `${ORIGIN}/forum.php?${new URLSearchParams(params)}`;
}

async function postForm(url: string, fields: URLSearchParams): Promise<ReplyOutcome> {
  const response = await fetch(url, { method: "POST", credentials: "include", headers: AJAX_HEADERS, body: fields });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseReplyResponse(await response.text());
}

/** 按浏览器提交表单的规则收集字段：未勾选的复选框不提交，正文由调用方填 */
function formFields(form: HTMLFormElement, message: string): URLSearchParams {
  const fields = new URLSearchParams();
  for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) {
    if (SKIPPED_INPUTS.has(input.type)) continue;
    if ((input.type === "checkbox" || input.type === "radio") && !input.checked) continue;
    fields.append(input.name, input.value);
  }
  fields.set("message", message);
  return fields;
}

/** 回复楼主：与帖子底部快速回复框提交的内容一致 */
function replyToThread(request: ReplyRequest): Promise<ReplyOutcome> {
  const url = forumUrl({
    mod: "post", action: "reply", fid: request.fid, tid: request.tid, extra: "",
    replysubmit: "yes", infloat: "yes", handlekey: "fastpost", inajax: "1"
  });
  return postForm(url, new URLSearchParams({ message: request.message, formhash: request.formhash, usesig: "", subject: " " }));
}

/**
 * 答复某楼：先取这一楼的回复表单，再连同正文提交。
 * 表单里的引用内容和“通知层主”字段是服务器加密生成的，自己拼的话层主收不到提醒。
 */
async function replyToFloor(request: ReplyRequest, floor: NonNullable<ReplyRequest["floor"]>): Promise<ReplyOutcome> {
  const formUrl = forumUrl({
    mod: "post", action: "reply", fid: request.fid, tid: request.tid, [floor.mode]: floor.pid, extra: "", page: "1",
    infloat: "yes", handlekey: "reply", inajax: "1", ajaxtarget: "fwin_content_reply"
  });
  const response = await fetch(formUrl, { credentials: "include", headers: AJAX_HEADERS });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const form = new DOMParser().parseFromString(cdata(text), "text/html").querySelector<HTMLFormElement>("#postform");
  // 拿不到表单说明不能回（帖子关闭、没有权限、登录失效），把服务器的原因带回去
  if (!form) return { ...parseReplyResponse(text), ok: false, pid: null };
  // 提交地址自己拼，不信任表单里的 action
  const submitUrl = forumUrl({
    mod: "post", infloat: "yes", action: "reply", fid: request.fid, extra: "", tid: request.tid, replysubmit: "yes", inajax: "1"
  });
  return postForm(submitUrl, formFields(form, request.message));
}

export async function submitReply(request: ReplyRequest): Promise<ReplyOutcome> {
  assertRequest(request);
  return request.floor ? replyToFloor(request, request.floor) : replyToThread(request);
}
