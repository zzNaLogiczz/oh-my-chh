// 门户解析：频道文章列表（portal.php?mod=list）与文章页（article-aid-页.html）
import type { ArticlePage, ArticleRow, NavLink, PortalListPage, Post } from "../model";
import { absUrl, breadcrumbLinks, forumIndexLink, parseCount, parsePageInfo, text } from "./common";
import { detectExcelRoute } from "./route";
import { extractBlocks } from "./thread-detail";

/** 上级：面包屑里最后一个频道列表链接；顶级频道回到版块列表（频道导航在那里） */
function portalParent(doc: Document, base: string): NavLink {
  const lists = breadcrumbLinks(doc, base).filter((link) => detectExcelRoute(new URL(link.url)) === "portal-list");
  return lists[lists.length - 1] ?? forumIndexLink(base);
}

function articleIdOf(url: string): string | null {
  return url.match(/\/article-(\d+)-\d+\.html/)?.[1] ?? new URL(url).searchParams.get("aid");
}

function parseArticleRow(item: Element, base: string): ArticleRow | null {
  const link = item.querySelector("dt a");
  const url = absUrl(link?.getAttribute("href"), base);
  const aid = url ? articleIdOf(url) : null;
  if (!link || !url || !aid) return null;
  // 第二个 dd 是“分类: X  时间”，第一个 dd（xs2）是摘要
  const meta = [...item.querySelectorAll("dd")].find((dd) => text(dd).startsWith("分类"));
  const category = meta?.querySelector("label a");
  return {
    aid,
    title: text(link),
    url,
    category: text(category) || null,
    categoryUrl: absUrl(category?.getAttribute("href"), base),
    postedAt: text(meta?.querySelector(".xg1")) || null,
    summary: text(item.querySelector("dd.xs2"))
  };
}

export function parsePortalList(doc: Document, base: string): PortalListPage {
  const articles: ArticleRow[] = [];
  for (const item of doc.querySelectorAll("#ct .xld > dl")) {
    const row = parseArticleRow(item, base);
    if (row) articles.push(row);
  }
  return {
    kind: "portal-list",
    catid: new URL(base).searchParams.get("catid") ?? "",
    name: text(doc.querySelector("#ct .bm_h h1")),
    articles,
    pageInfo: parsePageInfo(doc, base),
    parent: portalParent(doc, base)
  };
}

function parseComment(item: Element, index: number, base: string): Post | null {
  const id = item.id.match(/^comment_(\d+)_li$/)?.[1];
  const body = item.querySelector("dd");
  if (!id || !body) return null;
  return {
    pid: `c${id}`,
    floor: index + 1,
    author: text(item.querySelector("dt a.xw1")) || "匿名",
    avatar: null,
    postedAt: text(item.querySelector("dt .xg1")) || null,
    locked: false,
    blocks: extractBlocks(body, base)
  };
}

export function parseArticle(doc: Document, base: string): ArticlePage {
  const aid = articleIdOf(base) ?? "";
  const pageInfo = parsePageInfo(doc, base);
  const header = doc.querySelector("#ct .h.hm p.xg1");
  const content = doc.querySelector("#article_content");
  const posts: Post[] = [{
    pid: `a${aid}-${pageInfo.page}`,
    floor: 0,
    label: "正文",
    author: text(header?.querySelector("a[href*='space-uid']")) || "匿名",
    avatar: null,
    postedAt: text(header).match(/\d{4}-\d{1,2}-\d{1,2}(?: \d{1,2}:\d{2})?/)?.[0] ?? null,
    locked: false,
    blocks: content ? extractBlocks(content, base) : []
  }];
  // 每一页都带同一份“最新评论”，只在第一页收录，避免翻页追加时重复
  if (pageInfo.page === 1) {
    [...doc.querySelectorAll("#comment_ul > dl[id^=comment_]")].forEach((item, index) => {
      const comment = parseComment(item, index, base);
      if (comment) posts.push(comment);
    });
  }
  return {
    kind: "article",
    aid,
    title: text(doc.querySelector("#ct h1.ph")),
    views: parseCount(text(doc.querySelector("#_viewnum"))),
    comments: parseCount(text(doc.querySelector("#_commentnum"))),
    posts,
    pageInfo,
    parent: portalParent(doc, base)
  };
}
