// 站内搜索结果解析：search.php?mod=forum 的 li.pbw 列表
import type { SearchPage, SearchRow } from "../model";
import { absUrl, forumIndexLink, parseCount, parsePageInfo, text } from "./common";

function parseResult(item: Element, base: string): SearchRow | null {
  const link = item.querySelector("h3 a");
  const url = absUrl(link?.getAttribute("href"), base);
  if (!link || !url) return null;
  // 段落依次为：统计（N 个回复 - M 次查看）、摘要、元信息（时间 - 作者 - 版块）
  const paragraphs = [...item.querySelectorAll(":scope > p")];
  const stats = text(paragraphs[0]);
  const meta = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : null;
  const metaSpans = meta ? [...meta.querySelectorAll(":scope > span")] : [];
  return {
    tid: item.id || new URL(url).searchParams.get("tid") || "",
    title: text(link),
    url,
    replies: parseCount(stats.match(/([\d,]+)\s*个回复/)?.[1]),
    views: parseCount(stats.match(/([\d,]+)\s*次查看/)?.[1]),
    snippet: paragraphs.length > 2 ? text(paragraphs[1]) : "",
    postedAt: text(metaSpans[0]) || null,
    author: text(metaSpans[1]) || null,
    forumName: text(metaSpans[2]) || null
  };
}

export function parseSearch(doc: Document, url: string): SearchPage {
  const heading = text(doc.querySelector(".sttl"));
  const keyword = new URL(url).searchParams.get("kw") ?? heading.match(/“(.+?)”/)?.[1] ?? "";
  const results: SearchRow[] = [];
  for (const item of doc.querySelectorAll("li.pbw")) {
    const row = parseResult(item, url);
    if (row) results.push(row);
  }
  return {
    kind: "search",
    keyword,
    total: parseCount(heading.match(/相关内容\s*([\d,]+)\s*个/)?.[1]),
    results,
    pageInfo: parsePageInfo(doc, url),
    parent: forumIndexLink(url)
  };
}
