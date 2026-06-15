import { afterEach, describe, expect, it } from "vitest";
import { detectRoute } from "../../src/foundation/route";

function setPage(url: string, bodyId = "", bodyClass = ""): void {
  window.history.replaceState({}, "", url);
  document.body.id = bodyId;
  document.body.className = bodyClass;
  document.body.innerHTML = "";
}

afterEach(() => {
  setPage("https://www.chiphell.com/");
});

describe("detectRoute", () => {
  it.each([
    ["https://www.chiphell.com/portal.php", "", "", "portal-home"],
    ["https://www.chiphell.com/forum.php", "", "", "forum-index"],
    ["https://www.chiphell.com/forum-146-1.html", "", "", "thread-list"],
    ["https://www.chiphell.com/thread-123-1-1.html", "", "", "thread-detail"],
    ["https://www.chiphell.com/article-34976-1.html", "", "", "article-view"],
    ["https://www.chiphell.com/space-uid-2.html", "", "", "profile"],
    ["https://www.chiphell.com/home.php?mod=spacecp&ac=avatar", "", "", "settings"],
    ["https://www.chiphell.com/home.php?mod=space&do=pm&filter=privatepm", "", "", "messages"],
    ["https://www.chiphell.com/home.php?mod=space&do=notice", "", "", "messages"],
    ["https://www.chiphell.com/post.php?action=newthread&fid=146", "", "", "compose"]
  ])("maps %s to %s", (url, bodyId, bodyClass, expected) => {
    setPage(url, bodyId, bodyClass);
    expect(detectRoute()).toBe(expected);
  });

  it("uses Discuz body identifiers as fallback", () => {
    setPage("https://www.chiphell.com/forum.php?mod=forumdisplay&fid=146", "nv_forum", "pg_forumdisplay");
    expect(detectRoute()).toBe("thread-list");
  });
});
