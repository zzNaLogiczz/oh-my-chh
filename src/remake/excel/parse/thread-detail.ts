// 帖子详情解析：楼层元信息 + 正文块（纯文本 / 图片 / 引用），绝不保留原 HTML
import type { FloorReplyMode, NavLink, Post, PostBlock, ReplyForm, ThreadDetailPage } from "../model";
import { absUrl, forumIndexLink, idFromHref, parseCount, parsePageInfo, text, timeText } from "./common";

const BLOCK_TAGS = new Set(["div", "p", "li", "ul", "ol", "table", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"]);
const SKIP_SELECTOR = ".aimg_tip, .tip, i.pstatus, .attach_nopermission";

/** 文本节点按 HTML 渲染规则压缩空白；显式换行来自 br 与块级边界 */
function normalizeText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isSmiley(img: Element): boolean {
  return img.hasAttribute("smilieid") || (img.getAttribute("src") ?? "").includes("static/image/smiley/");
}

function imageBlock(img: Element, base: string): PostBlock | null {
  const src = absUrl(img.getAttribute("zoomfile") ?? img.getAttribute("file") ?? img.getAttribute("src"), base);
  // Discuz 的占位图与界面图标（static/image/common）不是帖子内容
  if (!src || src.includes("/static/image/common/")) return null;
  const tipName = text(img.closest("ignore_js_op")?.querySelector(".aimg_tip strong"));
  const name = tipName || decodeURIComponent(new URL(src).pathname.split("/").pop() ?? "image");
  return { kind: "image", src, name };
}

/** 引用框：首行“作者 发表于 时间”单独取作者，其余为引用正文 */
function quoteBlock(quote: Element, base: string): PostBlock {
  const blockquote = quote.querySelector("blockquote") ?? quote;
  const header = blockquote.querySelector("a[href*='findpost']")?.closest("font") ?? blockquote.querySelector("font[color]");
  const headerText = text(header);
  const author = headerText.includes(" 发表于 ") ? headerText.split(" 发表于 ")[0].trim() : null;
  const inner = extractBlocks(blockquote, base, header ?? undefined);
  const body = inner.map((b) => (b.kind === "text" ? b.text : b.kind === "image" ? "[图片]" : b.text)).join("\n");
  return { kind: "quote", author, text: normalizeText(body) };
}

export function extractBlocks(root: Element, base: string, skip?: Element): PostBlock[] {
  const blocks: PostBlock[] = [];
  let buffer = "";
  const flush = (): void => {
    const value = normalizeText(buffer);
    if (value) blocks.push({ kind: "text", text: value });
    buffer = "";
  };

  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      buffer += (node.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    // 脚本、样式、附件提示菜单、编辑记录一律不进入正文
    if (el === skip || tag === "script" || tag === "style" || el.matches(SKIP_SELECTOR)) return;
    if (tag === "br") { buffer += "\n"; return; }
    if (tag === "iframe" || tag === "embed") { buffer += "[视频]"; return; }
    if (tag === "img") {
      if (isSmiley(el)) { buffer += "[表情]"; return; }
      const image = imageBlock(el, base);
      if (image) { flush(); blocks.push(image); }
      return;
    }
    if (el.classList.contains("quote")) {
      flush();
      blocks.push(quoteBlock(el, base));
      return;
    }
    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) buffer += "\n";
    for (const child of el.childNodes) walk(child);
    if (isBlock) buffer += "\n";
  };

  for (const child of root.childNodes) walk(child);
  flush();
  return blocks;
}

/** 每楼的“回复”按钮：楼主那一楼是 reppost（只通知），其余楼层是 repquote（引用） */
function replyModeOf(node: Element): FloorReplyMode | undefined {
  const href = node.querySelector("a.fastre")?.getAttribute("href") ?? "";
  if (/[?&]repquote=\d/.test(href)) return "repquote";
  if (/[?&]reppost=\d/.test(href)) return "reppost";
  return undefined;
}

function parsePost(node: Element, base: string): Post | null {
  const pid = node.id.replace(/^post_/, "");
  if (!/^\d+$/.test(pid)) return null;
  const floor = parseCount(text(node.querySelector(".plc .pi strong a em"))) ?? 0;
  const locked = Boolean(node.querySelector(".plc .locked"));
  const content = node.querySelector("td.t_f");
  return {
    pid,
    floor,
    author: text(node.querySelector(".pls .authi a.xw1")) || text(node.querySelector(".pls .authi")) || "匿名",
    avatar: absUrl(node.querySelector(".pls .avatar img")?.getAttribute("src"), base),
    postedAt: timeText(node.querySelector("em[id^=authorposton]")),
    locked,
    // 被屏蔽楼层只保留元信息，内容由渲染层显示“（内容已屏蔽）”
    blocks: locked || !content ? [] : extractBlocks(content, base),
    replyMode: replyModeOf(node)
  };
}

/** 页面底部的快速回复框：没登录、帖子关闭或没有回帖权限时不存在，也就不能回帖 */
function quickReplyForm(doc: Document, base: string): { form: ReplyForm | null; tid: string | null } {
  const form = doc.querySelector<HTMLFormElement>("#fastpostform");
  if (!form) return { form: null, tid: null };
  const params = new URL(form.getAttribute("action") ?? "", base).searchParams;
  const fid = params.get("fid") ?? "";
  const tid = params.get("tid");
  const formhash = form.querySelector<HTMLInputElement>("input[name=formhash]")?.value ?? "";
  return {
    form: /^\d+$/.test(fid) && /^\w+$/.test(formhash) ? { fid, formhash } : null,
    tid: tid && /^\d+$/.test(tid) ? tid : null
  };
}

function headerCount(doc: Document, label: string): number | null {
  const match = text(doc.querySelector(".hm.ptn")).match(new RegExp(`${label}[:：]\\s*([\\d,]+)`));
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

/** 进入帖子前所在的列表页码：伪静态 thread-tid-页-列表页.html，或 viewthread 的 extra=page%3DN */
function listPageOf(url: string): number {
  const pretty = url.match(/\/thread-\d+-\d+-(\d+)\.html/);
  if (pretty) return Number(pretty[1]) || 1;
  const extra = new URL(url).searchParams.get("extra") ?? "";
  return Number(extra.match(/page=(\d+)/)?.[1] ?? 1) || 1;
}

function threadParent(forumLink: Element | undefined, base: string): NavLink {
  const fid = idFromHref(forumLink?.getAttribute("href"), "forum");
  const url = fid ? absUrl(`forum-${fid}-${listPageOf(base)}.html`, base) : null;
  return url ? { name: text(forumLink) || "帖子列表", url } : forumIndexLink(base);
}

export function parseThreadDetail(doc: Document, base: string): ThreadDetailPage {
  // 面包屑里最后一个版块链接即所属版块
  const forumLinks = [...doc.querySelectorAll("#pt a")].filter((a) => idFromHref(a.getAttribute("href"), "forum"));
  const firstPost = doc.querySelector("#postlist > div[id^=post_]");
  const quick = quickReplyForm(doc, base);
  const tid = idFromHref(firstPost?.querySelector(".plc .pi strong a")?.getAttribute("href"), "thread")
    ?? idFromHref(base, "thread") ?? quick.tid ?? "";
  const posts: Post[] = [];
  for (const node of doc.querySelectorAll("#postlist > div[id^=post_]")) {
    const post = parsePost(node, base);
    if (post) posts.push(post);
  }
  return {
    kind: "thread-detail",
    tid,
    title: text(doc.querySelector("#thread_subject")),
    forumName: text(forumLinks[forumLinks.length - 1]) || null,
    views: headerCount(doc, "查看"),
    replies: headerCount(doc, "回复"),
    posts,
    pageInfo: parsePageInfo(doc, base),
    parent: threadParent(forumLinks[forumLinks.length - 1], base),
    reply: quick.form
  };
}
