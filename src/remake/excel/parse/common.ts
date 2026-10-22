// 解析公共工具：文本压缩、精确计数、绝对地址、分页信息、面包屑
import type { NavLink, PageInfo } from "../model";

export function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 解析“1万”“326万”“3,964”这类显示值；无法识别返回 null */
export function parseCount(raw: string | null | undefined): number | null {
  const value = (raw ?? "").replace(/,/g, "").trim();
  const match = value.match(/(\d+(?:\.\d+)?)\s*(万|亿)?/);
  if (!match) return null;
  const base = Number(match[1]);
  const scale = match[2] === "亿" ? 1e8 : match[2] === "万" ? 1e4 : 1;
  return Math.round(base * scale);
}

/** 优先取 span[title] 里的精确值（Discuz 对大数显示缩写、title 存原值） */
export function exactCount(el: Element | null | undefined): number | null {
  if (!el) return null;
  const titled = el.matches("span[title]") ? el : el.querySelector("span[title]");
  const title = titled?.getAttribute("title") ?? "";
  if (/^\d[\d,]*$/.test(title)) return Number(title.replace(/,/g, ""));
  return parseCount(text(el));
}

export function absUrl(href: string | null | undefined, base: string): string | null {
  if (!href || /^javascript:/i.test(href)) return null;
  try {
    const url = new URL(href, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function idFromHref(href: string | null | undefined, kind: "forum" | "thread"): string | null {
  const source = href ?? "";
  const pretty = source.match(kind === "forum" ? /forum-(\d+)-/ : /thread-(\d+)-/);
  if (pretty) return pretty[1];
  const query = source.match(kind === "forum" ? /[?&]fid=(\d+)/ : /[?&]tid=(\d+)/);
  return query ? query[1] : null;
}

/** 时间显示：近期帖子显示“1 小时前”，完整时间在 span[title] 里 */
export function timeText(el: Element | null | undefined): string | null {
  if (!el) return null;
  const titled = el.matches("span[title]") ? el : el.querySelector("span[title]");
  const title = titled?.getAttribute("title") ?? "";
  if (/\d{4}-\d{1,2}-\d{1,2}/.test(title)) return title.trim();
  const value = text(el).replace(/^发表于\s*/, "");
  return value || null;
}

const PAGE_TOKEN = "{page}";
const JUMP_SENTINEL = "987654321";

/** 从页码链接推导模板：取一个页码 ≥2 的链接，把地址里唯一一处同值数字段换成 {page} */
function templateFromLinks(pager: Element, base: string): string | null {
  for (const link of [...pager.querySelectorAll("a")].reverse()) {
    const label = text(link).replace(/^\.\.\.\s*/, "");
    if (!/^\d+$/.test(label) || label === "1") continue;
    const href = absUrl(link.getAttribute("href"), base);
    if (!href) continue;
    const hits = [...href.matchAll(new RegExp(`(?<=\\D)${label}(?=\\D|$)`, "g"))];
    if (hits.length !== 1 || hits[0].index === undefined) continue;
    return href.slice(0, hits[0].index) + PAGE_TOKEN + href.slice(hits[0].index + label.length);
  }
  return null;
}

/** 退路：Discuz 跳页输入框的 onkeydown 里写着 window.location='前缀'+this.value */
function templateFromJumpBox(pager: Element, base: string): string | null {
  const script = pager.querySelector("input[name=custompage]")?.getAttribute("onkeydown") ?? "";
  const match = script.match(/window\.location\s*=\s*'([^']*)'\s*\+\s*this\.value(?:\s*\+\s*'([^']*)')?/);
  if (!match) return null;
  return absUrl(`${match[1]}${JUMP_SENTINEL}${match[2] ?? ""}`, base)?.replace(JUMP_SENTINEL, PAGE_TOKEN) ?? null;
}

export function parsePageInfo(doc: Document, base: string): PageInfo {
  const pager = doc.querySelector(".pg");
  if (!pager) return { page: 1, totalPages: 1, nextUrl: null, prevUrl: null, pageUrlTemplate: null };
  const page = parseCount(text(pager.querySelector("strong"))) ?? 1;
  const totalSource = pager.querySelector("label span")?.getAttribute("title") ?? text(pager.querySelector("label span"));
  const total = totalSource.match(/(\d+)\s*页/);
  // 无“共 N 页”标签时，用最大的页码链接估算
  const numbered = [...pager.querySelectorAll("a")].map((a) => Number(text(a).replace(/^\.\.\.\s*/, ""))).filter(Number.isFinite);
  const totalPages = total ? Number(total[1]) : Math.max(page, ...numbered);
  return {
    page,
    totalPages,
    nextUrl: absUrl(pager.querySelector("a.nxt")?.getAttribute("href"), base),
    prevUrl: absUrl(pager.querySelector("a.prev")?.getAttribute("href"), base),
    pageUrlTemplate: templateFromLinks(pager, base) ?? templateFromJumpBox(pager, base)
  };
}

/** 第 n 页地址：越界返回 null；无模板时只能给出相邻页 */
export function pageUrl(info: PageInfo, n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > info.totalPages) return null;
  if (info.pageUrlTemplate) return info.pageUrlTemplate.replace(PAGE_TOKEN, String(n));
  if (n === info.page + 1) return info.nextUrl;
  if (n === info.page - 1) return info.prevUrl;
  return null;
}

/** 面包屑 #pt 里的全部链接（不含当前页的纯文本末项） */
export function breadcrumbLinks(doc: Document, base: string): NavLink[] {
  return [...doc.querySelectorAll("#pt .z a")]
    .map((a) => ({ name: text(a), url: absUrl(a.getAttribute("href"), base) ?? "" }))
    .filter((link) => link.name && link.url);
}

/** 定位到某个回帖：Discuz 会重定向到它所在的那一页 */
export function findPostUrl(tid: string, pid: string): string {
  return `https://www.chiphell.com/forum.php?mod=redirect&goto=findpost&ptid=${tid}&pid=${pid}`;
}

export function forumIndexLink(base: string): NavLink {
  return { name: "版块列表", url: absUrl("forum.php", base) ?? "https://www.chiphell.com/forum.php" };
}
