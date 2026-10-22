import { describe, expect, it } from "vitest";
import { detectExcelRoute } from "../../src/remake/excel/parse/route";
import { parseForumIndex } from "../../src/remake/excel/parse/forum-index";
import { parseThreadList } from "../../src/remake/excel/parse/thread-list";

import { FIXTURE_BASE as BASE, loadExcelFixture as loadFixture } from "./helpers/excel-fixtures";

const route = (path: string) => detectExcelRoute(new URL(path, BASE));

describe("detectExcelRoute", () => {
  it("recognizes the four supported page kinds in both URL styles", () => {
    expect(route("/forum.php")).toBe("forum-index");
    expect(route("/forum-283-1.html")).toBe("thread-list");
    expect(route("/forum.php?mod=forumdisplay&fid=283")).toBe("thread-list");
    expect(route("/thread-2192109-1-1.html")).toBe("thread-detail");
    expect(route("/forum.php?mod=viewthread&tid=2192109")).toBe("thread-detail");
    expect(route("/search.php?mod=forum&searchid=2604&kw=5090")).toBe("search");
  });

  it("separates the portal entry from unsupported pages", () => {
    expect(route("/")).toBe("portal-home");
    expect(route("/portal.php")).toBe("portal-home");
    expect(route("/space-uid-2.html")).toBe("unsupported");
    expect(route("/home.php?mod=space&do=pm")).toBe("unsupported");
  });
});

describe("parseForumIndex", () => {
  const page = parseForumIndex(loadFixture("forum-index"), BASE);

  it("returns every category including favorites, each with forums", () => {
    expect(page.kind).toBe("forum-index");
    expect(page.categories).toHaveLength(5);
    expect(page.categories[0].name).toBe("我收藏的版块");
    for (const category of page.categories) expect(category.forums.length).toBeGreaterThan(0);
  });

  it("reads exact counts from the grid layout", () => {
    const forum = page.categories.flatMap((c) => c.forums).find((f) => f.fid === "319");
    expect(forum).toMatchObject({ name: "原创分享(新)", today: 329, threads: 17878, posts: 827876 });
    expect(forum?.url).toBe("https://www.chiphell.com/forum-319-1.html");
    expect(forum?.lastPostAt).toBe("2026-10-21 17:17");
  });

  it("reads the row layout with last-post details", () => {
    const forum = page.categories[0].forums[0];
    expect(forum).toMatchObject({ fid: "312", name: "自由水世界2024", today: 3963, threads: 100608, posts: 3264180 });
    expect(forum.lastPostTitle).toBe("我的小家伙出生啦！");
    expect(forum.lastPostBy).toBe("sagittarius11");
    expect(forum.lastPostAt).toBe("2026-10-21 17:19");
  });
});

describe("parseThreadList", () => {
  const page = parseThreadList(loadFixture("thread-list"), BASE);

  it("identifies the forum", () => {
    expect(page).toMatchObject({ kind: "thread-list", fid: "283", forumName: "大恶魔的Blog" });
  });

  it("puts pinned threads first", () => {
    const pinned = page.threads.filter((t) => t.pinned);
    expect(pinned).toHaveLength(6);
    expect(page.threads.slice(0, 6).every((t) => t.pinned)).toBe(true);
  });

  it("extracts thread row fields", () => {
    const row = page.threads.find((t) => t.tid === "2260366");
    expect(row).toMatchObject({
      title: "【全坛最穷】其实天涯 的 速通成魔之路",
      author: "其实天涯",
      createdAt: "2020-9-16 20:01",
      replies: 83,
      views: 66614,
      lastPostBy: "fengpiaosasa",
      lastPostAt: "2026-10-21 17:09",
      url: "https://www.chiphell.com/thread-2260366-1-1.html"
    });
  });

  it("reads pagination", () => {
    expect(page.pageInfo).toEqual({
      page: 1, totalPages: 2, nextUrl: "https://www.chiphell.com/forum-283-2.html", prevUrl: null,
      pageUrlTemplate: "https://www.chiphell.com/forum-283-{page}.html"
    });
  });
});
