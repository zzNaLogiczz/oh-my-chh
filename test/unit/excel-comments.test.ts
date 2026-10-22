import { describe, expect, it, vi } from "vitest";
import { createImageVisibility } from "../../src/remake/excel/app/image-visibility";
import { renderCommentsPane } from "../../src/remake/excel/app/comments";
import { openFindDialog, searchUrl } from "../../src/remake/excel/app/find-dialog";
import { parseThreadDetail } from "../../src/remake/excel/parse/thread-detail";
import { FIXTURE_BASE, loadExcelFixture } from "./helpers/excel-fixtures";

const imagesPage = parseThreadDetail(loadExcelFixture("thread-2904948"), FIXTURE_BASE);
const lockedPage = parseThreadDetail(loadExcelFixture("thread-detail-p2"), FIXTURE_BASE);
const firstPid = imagesPage.posts[0].pid;

function mount(posts = imagesPage.posts, initial: "show" | "hide" = "show") {
  const host = document.createElement("div");
  document.body.append(host);
  const vis = createImageVisibility(initial);
  const onCardSelect = vi.fn();
  const pane = renderCommentsPane(host, posts, vis, { onCardSelect });
  const card = (pid: string) => host.querySelector<HTMLElement>(`[data-pid="${pid}"]`)!;
  return { host, vis, pane, card, onCardSelect };
}

describe("image visibility", () => {
  it("lets single posts override the global default until it changes", () => {
    const vis = createImageVisibility("show");
    expect(vis.isVisible("1")).toBe(true);
    vis.toggle("1");
    expect(vis.isVisible("1")).toBe(false);
    expect(vis.isVisible("2")).toBe(true);
    vis.setGlobal("hide");
    expect(vis.globalDefault).toBe("hide");
    expect(vis.isVisible("1")).toBe(false);
    vis.toggle("1");
    expect(vis.isVisible("1")).toBe(true);
    expect(vis.isVisible("2")).toBe(false);
  });
});

describe("comments pane", () => {
  it("shows thumbnails by default and file name chips when hidden globally", () => {
    const { vis, pane, card } = mount();
    expect(card(firstPid).querySelectorAll("img.xl-thumb")).toHaveLength(8);
    vis.setGlobal("hide");
    pane.refreshImages();
    expect(card(firstPid).querySelectorAll("img.xl-thumb")).toHaveLength(0);
    const chips = card(firstPid).querySelectorAll(".xl-chip");
    expect(chips).toHaveLength(8);
    expect(chips[0].textContent).toContain("1.jpg");
  });

  it("toggles one card's images from its ··· menu", () => {
    const { card } = mount(imagesPage.posts, "hide");
    card(firstPid).querySelector<HTMLElement>(".xl-card-more")!.click();
    const item = card(firstPid).querySelector<HTMLElement>(".xl-card-menu button")!;
    expect(item.textContent).toBe("显示图片");
    item.click();
    expect(card(firstPid).querySelectorAll("img.xl-thumb")).toHaveLength(8);
    const second = imagesPage.posts.find((p) => p.blocks.some((b) => b.kind === "image") && p.pid !== firstPid);
    if (second) expect(card(second.pid).querySelectorAll("img.xl-thumb")).toHaveLength(0);
  });

  it("renders quotes with their author and blocked floors as a placeholder", () => {
    const { host } = mount();
    const quote = [...host.querySelectorAll(".xl-quote")].find((q) => q.textContent?.includes("kezhang78"));
    expect(quote?.textContent).toContain("新西兰king salmon");
    const blocked = lockedPage.posts.find((p) => p.floor === 33)!;
    const pane = mount(lockedPage.posts);
    expect(pane.card(blocked.pid).textContent).toContain("（内容已屏蔽）");
  });

  it("never renders post text as markup", () => {
    const { host } = mount([{ pid: "9", floor: 2, author: "x", avatar: null, postedAt: null, locked: false, blocks: [{ kind: "text", text: "<b>粗</b><script>alert(1)</script>" }] }]);
    expect(host.querySelector("b, script")).toBeNull();
    expect(host.textContent).toContain("<b>粗</b>");
  });

  it("focuses a card and reports card clicks", () => {
    const { pane, card, onCardSelect } = mount();
    const pid = imagesPage.posts[2].pid;
    pane.focusPost(pid);
    expect(card(pid).classList.contains("is-current")).toBe(true);
    card(firstPid).click();
    expect(onCardSelect).toHaveBeenCalledWith(firstPid);
  });

  it("appends later pages", () => {
    const { host, pane } = mount(imagesPage.posts.slice(0, 2));
    pane.appendPosts(imagesPage.posts.slice(2, 4));
    expect(host.querySelectorAll(".xl-card")).toHaveLength(4);
  });
});

describe("find dialog", () => {
  it("builds a Discuz search URL", () => {
    expect(searchUrl("5090 显卡")).toBe("https://www.chiphell.com/search.php?mod=forum&srchtxt=5090%20%E6%98%BE%E5%8D%A1&searchsubmit=yes");
  });

  it("submits on Enter and closes on Escape", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const onSubmit = vi.fn();
    openFindDialog(host, onSubmit);
    const input = host.querySelector<HTMLInputElement>(".xl-dialog input")!;
    input.value = "5090";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSubmit).toHaveBeenCalledWith("5090");
    expect(host.querySelector(".xl-dialog")).toBeNull();

    openFindDialog(host, onSubmit);
    host.querySelector<HTMLInputElement>(".xl-dialog input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(host.querySelector(".xl-dialog")).toBeNull();
  });
});
