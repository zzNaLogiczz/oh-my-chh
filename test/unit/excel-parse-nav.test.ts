import { describe, expect, it } from "vitest";
import { parsePage } from "../../src/remake/excel/parse";
import { pageUrl } from "../../src/remake/excel/parse/common";
import { detectExcelRoute } from "../../src/remake/excel/parse/route";
import type { ArticlePage, ForumIndexPage, PortalListPage, SearchPage, ThreadDetailPage, ThreadListPage } from "../../src/remake/excel/model";
import { FIXTURE_BASE as BASE, loadExcelFixture } from "./helpers/excel-fixtures";

const route = (path: string) => detectExcelRoute(new URL(path, BASE));
const parse = <T>(fixture: string, url: string) => parsePage(loadExcelFixture(fixture), new URL(url, BASE).href) as T;
const FORUM_INDEX = { name: "版块列表", url: "https://www.chiphell.com/forum.php" };

describe("portal routes", () => {
  it("routes channel lists and articles instead of treating every portal.php as the home page", () => {
    expect(route("/portal.php")).toBe("portal-home");
    expect(route("/portal.php?mod=index")).toBe("portal-home");
    expect(route("/portal.php?mod=list&catid=1")).toBe("portal-list");
    expect(route("/article-35543-1.html")).toBe("article");
    expect(route("/portal.php?mod=view&aid=35543&page=2")).toBe("article");
    expect(route("/portal.php?mod=comment&id=35543&idtype=aid")).toBe("unsupported");
  });
});

describe("channel navigation on the forum index", () => {
  const page = parse<ForumIndexPage>("forum-index", "/forum.php");

  it("lists the portal channels from the header nav, skipping home and community", () => {
    const names = page.channels.map((c) => c.name);
    expect(names[0]).toBe("评测");
    expect(names).not.toContain("首页");
    expect(names).not.toContain("社区");
    expect(names).toEqual(expect.arrayContaining(["电脑", "掌设", "家居", "文化"]));
  });

  it("keeps each channel's second-level menu as absolute links", () => {
    const review = page.channels.find((c) => c.name === "评测")!;
    expect(review.url).toBe("https://www.chiphell.com/portal.php?mod=list&catid=1");
    expect(review.subs[0]).toEqual({ name: "视频评测", url: "https://www.chiphell.com/portal.php?mod=list&catid=39" });
    expect(review.subs.length).toBeGreaterThanOrEqual(10);
    expect(page.channels.find((c) => c.name === "家居")!.subs).toEqual([]);
  });
});

describe("pagination info", () => {
  it("builds any page URL from the pager links, keeping the site's URL style", () => {
    const list = parse<ThreadListPage>("thread-list", "/forum-283-1.html");
    expect(pageUrl(list.pageInfo, 2)).toBe("https://www.chiphell.com/forum-283-2.html");
    expect(list.pageInfo.prevUrl).toBeNull();
    const thread = parse<ThreadDetailPage>("thread-2904948", "/thread-2904948-1-3.html");
    expect(pageUrl(thread.pageInfo, 2)).toBe("https://www.chiphell.com/forum.php?mod=viewthread&tid=2904948&extra=&page=2");
  });

  it("falls back to the Discuz page-jump box when no numbered link is usable", async () => {
    const { parsePageInfo } = await import("../../src/remake/excel/parse/common");
    const doc = new DOMParser().parseFromString(
      `<div class="pg"><strong>1</strong><label><input name="custompage" onkeydown="if(event.keyCode==13) {window.location='forum.php?mod=forumdisplay&amp;fid=1&amp;page='+this.value;; doane(event);}"><span title="共 9 页"> / 9 页</span></label></div>`,
      "text/html"
    );
    expect(pageUrl(parsePageInfo(doc, BASE), 7)).toBe("https://www.chiphell.com/forum.php?mod=forumdisplay&fid=1&page=7");
  });

  it("exposes the previous page on later pages", () => {
    const detail = parse<ThreadDetailPage>("thread-detail-p2", "/forum.php?mod=viewthread&tid=2192109&extra=&page=2");
    expect(detail.pageInfo.page).toBe(2);
    expect(detail.pageInfo.prevUrl).toBe("https://www.chiphell.com/forum.php?mod=viewthread&tid=2192109&extra=&page=1");
    expect(pageUrl(detail.pageInfo, 5)).toBe("https://www.chiphell.com/forum.php?mod=viewthread&tid=2192109&extra=&page=5");
  });

  it("returns null when a page has no pager", () => {
    const index = parse<ForumIndexPage>("forum-index", "/forum.php") as unknown as { pageInfo?: unknown };
    expect(index.pageInfo).toBeUndefined();
    expect(pageUrl({ page: 1, totalPages: 1, nextUrl: null, prevUrl: null, pageUrlTemplate: null }, 2)).toBeNull();
  });
});

describe("parent links", () => {
  it("sends a thread back to its forum list page, keeping the list page number", () => {
    const detail = parse<ThreadDetailPage>("thread-2904948", "/thread-2904948-1-3.html");
    expect(detail.parent).toEqual({ name: "原创分享(新)", url: "https://www.chiphell.com/forum-319-3.html" });
    const plain = parse<ThreadDetailPage>("thread-detail-p2", "/forum.php?mod=viewthread&tid=2192109&extra=&page=2");
    expect(plain.parent).toEqual({ name: "建议意见及投诉", url: "https://www.chiphell.com/forum-22-1.html" });
  });

  it("sends thread lists and search results back to the forum index", () => {
    expect(parse<ThreadListPage>("thread-list", "/forum-283-1.html").parent).toEqual(FORUM_INDEX);
    expect(parse<SearchPage>("search", "/search.php?mod=forum&searchid=2604&kw=5090").parent).toEqual(FORUM_INDEX);
  });
});

describe("portal list", () => {
  const page = parse<PortalListPage>("portal-list", "/portal.php?mod=list&catid=1");

  it("reads the channel name and article rows with their category links", () => {
    expect(page.kind).toBe("portal-list");
    expect(page.name).toBe("评测");
    expect(page.articles.length).toBeGreaterThanOrEqual(10);
    expect(page.articles[0]).toMatchObject({
      aid: "35543", title: "ASUS ProArt B850-Creator WiFi Neo 评测",
      url: "https://www.chiphell.com/article-35543-1.html", category: "主板",
      categoryUrl: "https://www.chiphell.com/portal.php?mod=list&catid=15", postedAt: "2026-10-20 19:51"
    });
    expect(page.articles[0].summary).toMatch(/^2026年的AMD台式机/);
  });

  it("paginates and points top channels back to the forum index", () => {
    expect(page.pageInfo.totalPages).toBe(147);
    expect(pageUrl(page.pageInfo, 3)).toBe("https://www.chiphell.com/portal.php?mod=list&catid=1&page=3");
    expect(page.parent).toEqual(FORUM_INDEX);
  });

  it("points a sub-category back to its channel", () => {
    const sub = parse<PortalListPage>("portal-list-sub", "/portal.php?mod=list&catid=15");
    expect(sub.name).toBe("主板");
    expect(sub.parent).toEqual({ name: "评测", url: "https://www.chiphell.com/portal.php?mod=list&catid=1" });
  });
});

describe("article", () => {
  const page = parse<ArticlePage>("article", "/article-35543-1.html");

  it("reads the header and turns the body into the first comment card", () => {
    expect(page).toMatchObject({ kind: "article", aid: "35543", title: "ASUS ProArt B850-Creator WiFi Neo 评测", views: 3433, comments: 3 });
    const body = page.posts[0];
    expect(body).toMatchObject({ label: "正文", author: "nApoleon", postedAt: "2026-10-20 19:51", locked: false });
    expect(body.blocks[0]).toEqual({ kind: "text", text: expect.stringContaining("序言") });
    expect(body.blocks.some((b) => b.kind === "image")).toBe(true);
  });

  it("appends the latest comments after the body on the first page only", () => {
    expect(page.posts).toHaveLength(4);
    expect(page.posts[1]).toMatchObject({ author: "herrylee", postedAt: "2026-10-21 13:58" });
    expect(page.posts[1].blocks[0]).toEqual({ kind: "text", text: expect.stringContaining("pci-e拆分") });
    const second = parse<ArticlePage>("article-p2", "/article-35543-2.html");
    expect(second.posts).toHaveLength(1);
    expect(second.pageInfo.page).toBe(2);
    expect(second.pageInfo.prevUrl).toBe("https://www.chiphell.com/article-35543-1.html");
  });

  it("paginates and points back to its category", () => {
    expect(page.pageInfo.totalPages).toBe(5);
    expect(pageUrl(page.pageInfo, 4)).toBe("https://www.chiphell.com/article-35543-4.html");
    expect(page.parent).toEqual({ name: "主板", url: "https://www.chiphell.com/portal.php?mod=list&catid=15" });
  });
});
