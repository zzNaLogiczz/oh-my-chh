import { describe, expect, it } from "vitest";
import { parseThreadDetail } from "../../src/remake/excel/parse/thread-detail";
import { parseSearch } from "../../src/remake/excel/parse/search";
import { parsePage } from "../../src/remake/excel/parse";
import type { Post, PostBlock } from "../../src/remake/excel/model";
import { FIXTURE_BASE as BASE, loadExcelFixture } from "./helpers/excel-fixtures";

const images = (post: Post) => post.blocks.filter((b): b is Extract<PostBlock, { kind: "image" }> => b.kind === "image");
const texts = (post: Post) => post.blocks.filter((b) => b.kind === "text").map((b) => (b as { text: string }).text);
const byFloor = (posts: Post[], floor: number) => posts.find((p) => p.floor === floor)!;

describe("parseThreadDetail", () => {
  const page = parseThreadDetail(loadExcelFixture("thread-detail"), BASE);

  it("reads the thread header", () => {
    expect(page.kind).toBe("thread-detail");
    expect(page.title).toBe('论坛已支持帖内插入"B站"视频.');
    expect(page.views).toBe(208237);
    expect(page.replies).toBe(212);
    expect(page.forumName).toBe("建议意见及投诉");
    expect(page.posts).toHaveLength(30);
    expect(page.pageInfo.totalPages).toBeGreaterThanOrEqual(7);
  });

  it("reads the first floor author, time, avatar and images", () => {
    const first = byFloor(page.posts, 1);
    expect(first).toMatchObject({ pid: "44409514", author: "nApoleon", postedAt: "2020-3-3 20:19", locked: false });
    expect(first.avatar).toBe("https://www.chiphell.com/data/avatar/000/00/00/02_avatar_middle.jpg");
    const pics = images(first);
    expect(pics).toHaveLength(3);
    expect(pics[0]).toEqual({ kind: "image", src: "https://static.chiphell.com/forum/202003/03/201535pfhqmhsqt1z3sqzj.png", name: "未标题-1.png" });
    expect(texts(first)[0]).toContain("插入方法:");
  });

  it("keeps attachment menus and download links out of the text", () => {
    const all = texts(byFloor(page.posts, 1)).join("\n");
    expect(all).not.toContain("下载附件");
    expect(all).not.toContain("下载次数");
  });

  it("renders smilies as a text marker", () => {
    const all = page.posts.flatMap(texts).join("\n");
    expect(all).toContain("[表情]");
  });
});

describe("parseThreadDetail edge floors", () => {
  const page = parseThreadDetail(loadExcelFixture("thread-detail-p2"), BASE);

  it("marks blocked floors as locked with no content", () => {
    const blocked = byFloor(page.posts, 33);
    expect(blocked.locked).toBe(true);
    expect(blocked.blocks).toEqual([]);
  });

  it("drops script source embedded in post content", () => {
    const post = page.posts.find((p) => p.author === "donglia")!;
    expect(texts(post).join("\n")).not.toContain("document.getElementById");
  });

  it("keeps plain replies", () => {
    expect(texts(byFloor(page.posts, 31))).toEqual(["支持支持支持！"]);
  });
});

describe("parseThreadDetail images and quotes", () => {
  const page = parseThreadDetail(loadExcelFixture("thread-2904948"), BASE);

  it("collects every inline image with its attachment file name", () => {
    const pics = images(byFloor(page.posts, 1));
    expect(pics).toHaveLength(8);
    expect(pics[0].name).toBe("1.jpg");
  });

  it("turns quote boxes into quote blocks", () => {
    const quote = page.posts.flatMap((p) => p.blocks).find((b) => b.kind === "quote" && b.author === "kezhang78");
    expect(quote).toBeDefined();
    expect((quote as { text: string }).text).toContain("新西兰king salmon");
    expect((quote as { text: string }).text).not.toContain("发表于");
  });
});

describe("parseSearch", () => {
  const page = parseSearch(loadExcelFixture("search"), "https://www.chiphell.com/search.php?mod=forum&searchid=2604&orderby=lastpost&ascdesc=desc&searchsubmit=yes&kw=5090");

  it("reads keyword and totals", () => {
    expect(page).toMatchObject({ kind: "search", keyword: "5090", total: 500 });
    expect(page.results).toHaveLength(48);
  });

  it("strips highlight markup and reads result metadata", () => {
    expect(page.results[0]).toMatchObject({
      tid: "2910633",
      title: "5090D的Strata推理速度问题",
      replies: 20,
      views: 1329,
      author: "wolfpan",
      forumName: "电脑讨论(新)",
      postedAt: "2026-10-20 10:10"
    });
    expect(page.results[0].snippet).toContain("内存加到128G");
    expect(page.results[0].url).toMatch(/^https:\/\/www\.chiphell\.com\/forum\.php\?mod=viewthread&tid=2910633/);
  });

  it("links to the next page", () => {
    expect(page.pageInfo.nextUrl).toContain("page=2");
  });
});

describe("parsePage", () => {
  const html = (body: string) => new DOMParser().parseFromString(`<html><body>${body}</body></html>`, "text/html");

  it("detects a login wall before route parsing", () => {
    const page = parsePage(html('<div id="messagetext"><p>您需要先登录才能继续本操作</p></div>'), "https://www.chiphell.com/forum-283-1.html");
    expect(page).toEqual({ kind: "notice", reason: "login-required", message: "您需要先登录才能继续本操作" });
  });

  it("passes other Discuz messages through verbatim", () => {
    const page = parsePage(html('<div id="messagetext"><p>抱歉，您在 15 秒内只能进行一次搜索</p></div>'), "https://www.chiphell.com/search.php?mod=forum");
    expect(page).toEqual({ kind: "notice", reason: "message", message: "抱歉，您在 15 秒内只能进行一次搜索" });
  });

  it("reports unsupported routes as a notice", () => {
    expect(parsePage(html("<p>x</p>"), "https://www.chiphell.com/space-uid-2.html")).toEqual({
      kind: "notice", reason: "unsupported", message: "该内容在此模式下不可用"
    });
  });

  it("dispatches by route", () => {
    expect(parsePage(loadExcelFixture("thread-list"), "https://www.chiphell.com/forum-283-1.html").kind).toBe("thread-list");
    expect(parsePage(loadExcelFixture("forum-index"), "https://www.chiphell.com/forum.php").kind).toBe("forum-index");
  });
});
