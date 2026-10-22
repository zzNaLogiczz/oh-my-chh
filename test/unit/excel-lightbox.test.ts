import { afterEach, describe, expect, it, vi } from "vitest";
import { createExcelApp } from "../../src/remake/excel/app/app";
import { renderCommentsPane } from "../../src/remake/excel/app/comments";
import { createImageVisibility } from "../../src/remake/excel/app/image-visibility";
import { closeLightbox } from "../../src/remake/excel/app/lightbox";
import { DEFAULT_EXCEL_PREFS } from "../../src/remake/excel/prefs";
import { parseThreadDetail } from "../../src/remake/excel/parse/thread-detail";
import type { HostToApp } from "../../src/remake/excel/protocol";
import { FIXTURE_BASE, loadExcelFixture } from "./helpers/excel-fixtures";

const page = parseThreadDetail(loadExcelFixture("thread-2904948"), FIXTURE_BASE);
const images = page.posts.flatMap((post) => post.blocks.filter((block) => block.kind === "image"));

function mount(initial: "show" | "hide" = "show") {
  const host = document.createElement("div");
  document.body.append(host);
  const vis = createImageVisibility(initial);
  renderCommentsPane(host, page.posts, vis, { onCardSelect: vi.fn() });
  return { host, vis };
}
const lightbox = () => document.querySelector<HTMLElement>(".xl-lightbox");
const dbl = (el: Element) => el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
const key = (code: string) => lightbox()!.dispatchEvent(new KeyboardEvent("keydown", { key: code, bubbles: true }));

afterEach(() => {
  closeLightbox();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("image lightbox", () => {
  it("opens the double-clicked thumbnail in the middle of the page", () => {
    const { host } = mount();
    dbl(host.querySelectorAll("img.xl-thumb")[1]);
    const box = lightbox()!;
    expect(box.getAttribute("role")).toBe("dialog");
    expect(box.querySelector<HTMLImageElement>(".xl-lb-img")!.src).toBe(images[1].src);
    expect(box.querySelector(".xl-lb-name")!.textContent).toBe(images[1].name);
    expect(box.querySelector(".xl-lb-count")!.textContent).toBe(`2 / ${images.length}`);
    expect(document.activeElement).toBe(box);
  });

  it("flips through every visible image of the thread with the arrow keys and buttons", () => {
    const { host } = mount();
    dbl(host.querySelectorAll("img.xl-thumb")[0]);
    key("ArrowRight");
    expect(lightbox()!.querySelector<HTMLImageElement>(".xl-lb-img")!.src).toBe(images[1].src);
    key("ArrowLeft");
    key("ArrowLeft");
    // 首张再往前回到最后一张
    expect(lightbox()!.querySelector(".xl-lb-count")!.textContent).toBe(`${images.length} / ${images.length}`);
    lightbox()!.querySelector<HTMLElement>(".xl-lb-next")!.click();
    expect(lightbox()!.querySelector(".xl-lb-count")!.textContent).toBe(`1 / ${images.length}`);
  });

  it("closes on Escape, the close button or a click on the backdrop, and restores focus", () => {
    const { host } = mount();
    const thumb = host.querySelectorAll<HTMLElement>("img.xl-thumb")[0];
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    dbl(thumb);
    key("Escape");
    expect(lightbox()).toBeNull();
    expect(document.activeElement).toBe(before);
    dbl(thumb);
    lightbox()!.querySelector<HTMLElement>(".xl-lb-close")!.click();
    expect(lightbox()).toBeNull();
    dbl(thumb);
    lightbox()!.querySelector<HTMLElement>(".xl-lb-stage")!.click();
    expect(lightbox()).toBeNull();
  });

  it("toggles between fit-to-window and actual size by clicking the picture", () => {
    const { host } = mount();
    dbl(host.querySelectorAll("img.xl-thumb")[0]);
    const img = lightbox()!.querySelector<HTMLElement>(".xl-lb-img")!;
    img.click();
    expect(lightbox()!.classList.contains("is-actual")).toBe(true);
    expect(lightbox()).not.toBeNull();
    img.click();
    expect(lightbox()!.classList.contains("is-actual")).toBe(false);
  });

  it("leaves images of cards hidden by the user out of the slideshow", () => {
    const { host } = mount("hide");
    const withImages = page.posts.filter((post) => post.blocks.some((block) => block.kind === "image"));
    // 全局隐藏图片，只用 ··· 菜单打开第一个带图楼层
    host.querySelector<HTMLElement>(`[data-pid="${withImages[0].pid}"] .xl-card-more`)!.click();
    host.querySelector<HTMLElement>(`[data-pid="${withImages[0].pid}"] .xl-card-menu button`)!.click();
    const shown = withImages[0].blocks.filter((block) => block.kind === "image").length;
    dbl(host.querySelectorAll("img.xl-thumb")[0]);
    expect(lightbox()!.querySelector(".xl-lb-count")!.textContent).toBe(`1 / ${shown}`);
  });

  it("keeps single click as the in-pane enlarge without fighting the double click", () => {
    vi.useFakeTimers();
    const { host } = mount();
    const thumb = host.querySelectorAll<HTMLElement>("img.xl-thumb")[0];
    thumb.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    vi.advanceTimersByTime(400);
    expect(thumb.classList.contains("is-full")).toBe(true);
    thumb.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    thumb.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    dbl(thumb);
    vi.advanceTimersByTime(400);
    expect(thumb.classList.contains("is-full")).toBe(true);
    expect(lightbox()).not.toBeNull();
  });

  it("disappears with the boss key so the boss view stays plain Excel", async () => {
    sessionStorage.setItem("omchh-excel-forum", "1");
    const channel = new MessageChannel();
    const root = document.createElement("div");
    document.body.append(root);
    const app = createExcelApp(root, { port: channel.port2, prefs: DEFAULT_EXCEL_PREFS, workbook: null, openOptions: vi.fn() });
    channel.port1.postMessage({ type: "page", requestId: 1, url: "https://www.chiphell.com/thread-2904948-1-1.html", page, append: false, canBack: false } satisfies HostToApp);
    await vi.waitFor(() => expect(root.querySelector("img.xl-thumb")).not.toBeNull());
    dbl(root.querySelector("img.xl-thumb")!);
    expect(lightbox()).not.toBeNull();
    app.toggleBoss();
    expect(lightbox()).toBeNull();
    app.destroy();
    channel.port1.close();
    channel.port2.close();
    sessionStorage.clear();
  });
});
