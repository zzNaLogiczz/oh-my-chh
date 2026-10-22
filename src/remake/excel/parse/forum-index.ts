// 版块列表解析：同时支持行式（table.fl_tb tr）与格子式（td.fl_g）两种 Discuz 布局
import type { ForumCategory, ForumEntry, ForumIndexPage } from "../model";
import { absUrl, exactCount, idFromHref, parseCount, text } from "./common";
import { parseNavChannels } from "./nav";

function todayOf(em: Element | null): number | null {
  return em ? parseCount(text(em)) : null;
}

function parseRowForum(row: Element, base: string): ForumEntry | null {
  const link = row.querySelector("h2 a");
  const fid = idFromHref(link?.getAttribute("href"), "forum");
  const url = absUrl(link?.getAttribute("href"), base);
  if (!link || !fid || !url) return null;

  // 最后发表：cite 内为“时间 + 作者链接”，去掉作者文本即为时间
  const cite = row.querySelector("td.fl_by cite");
  const lastPostBy = text(cite?.querySelector("a")) || null;
  const lastPostAt = cite ? text(cite).replace(lastPostBy ?? "", "").trim() || null : null;
  return {
    fid, name: text(link), url,
    today: todayOf(row.querySelector("h2 em")),
    threads: exactCount(row.querySelector("td.fl_i .xi2")),
    posts: exactCount(row.querySelector("td.fl_i .xg1")),
    lastPostAt,
    lastPostTitle: text(row.querySelector("td.fl_by div > a")) || null,
    lastPostBy
  };
}

function parseGridForum(cell: Element, base: string): ForumEntry | null {
  const link = cell.querySelector("dt a");
  const fid = idFromHref(link?.getAttribute("href"), "forum");
  const url = absUrl(link?.getAttribute("href"), base);
  if (!link || !fid || !url) return null;

  // dd 内为“主题: N, 帖数: M”，按标签文字定位，避免依赖顺序
  const stats = [...cell.querySelectorAll("dd em")];
  const statFor = (label: string) => exactCount(stats.find((em) => text(em).startsWith(label)) ?? null);
  const last = text([...cell.querySelectorAll("dd a")].find((a) => text(a).includes("最后发表")) ?? null);
  return {
    fid, name: text(link), url,
    today: todayOf(cell.querySelector("dt em")),
    threads: statFor("主题"),
    posts: statFor("帖数"),
    lastPostAt: last.replace(/^最后发表[:：]\s*/, "") || null,
    lastPostTitle: null,
    lastPostBy: null
  };
}

export function parseForumIndex(doc: Document, base: string): ForumIndexPage {
  const categories: ForumCategory[] = [];
  for (const body of doc.querySelectorAll("div.bm_c[id^=category_]")) {
    // 分类名在同一 .bm 容器的标题栏里
    const name = text(body.closest(".bm")?.querySelector(".bm_h h2"));
    const forums: ForumEntry[] = [];
    for (const cell of body.querySelectorAll("td.fl_g")) {
      const forum = parseGridForum(cell, base);
      if (forum) forums.push(forum);
    }
    for (const row of body.querySelectorAll("table.fl_tb tr")) {
      if (row.querySelector("td.fl_g")) continue;
      const forum = parseRowForum(row, base);
      if (forum) forums.push(forum);
    }
    if (forums.length) categories.push({ id: body.id.replace(/^category_/, ""), name, forums });
  }
  return { kind: "forum-index", channels: parseNavChannels(doc, base), categories };
}
