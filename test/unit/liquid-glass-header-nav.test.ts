import { afterEach, describe, expect, it, vi } from "vitest";
import { EnhancementScope } from "../../src/platform/enhancement-scope";
import { DEFAULT_SETTINGS } from "../../src/preferences/settings";

const NativeURL = URL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("data-omchh-liquid-header-ready");
  document.documentElement.removeAttribute("data-chh-lg-scrolled");
  document.documentElement.className = "";
  document.body.className = "";
  window.history.pushState({}, "", "/");
});

function renderHeaderFixture(navItemsHtml: string): void {
  document.body.innerHTML = `
    <div id="toptb"></div>
    <div id="hd"><div class="hdc"><h2><a href="/">Chiphell</a></h2></div></div>
    <div id="nv_ph">
      <div id="nv">
        <a href="javascript:;" id="qmenu">快捷导航</a>
        <ul>${navItemsHtml}</ul>
      </div>
    </div>
    <div id="scbar"></div>
  `;
}

async function runHeaderEnhancement(): Promise<void> {
  const { enhanceLiquidGlassHeader } = await import("../../src/theming/themes/liquid-glass/adapter/header");
  enhanceLiquidGlassHeader(
    { root: document, route: "thread-list", settings: { ...DEFAULT_SETTINGS, themeId: "liquid-glass" } },
    new EnhancementScope()
  );
}

function installUrlSpy(): ReturnType<typeof vi.fn> {
  const urlSpy = vi.fn(function URLSpy(input: string | URL, base?: string | URL) {
    return new NativeURL(input, base);
  });
  vi.stubGlobal("URL", urlSpy as unknown as typeof URL);
  return urlSpy;
}

function navItems(): HTMLLIElement[] {
  return [...document.querySelectorAll<HTMLLIElement>("#nv > ul > li")];
}

describe("liquid-glass nav active cache", () => {
  it("does not rescore nav links when URL, nav structure, and active index are unchanged", async () => {
    window.history.pushState({}, "", "/forum.php");
    renderHeaderFixture(`<li><a href="/">首页</a></li><li class="a"><a href="/forum.php">社区</a></li>`);
    const urlSpy = installUrlSpy();

    await runHeaderEnhancement();
    const firstRunCalls = urlSpy.mock.calls.length;
    expect(navItems()[1].getAttribute("data-chh-lg-active")).toBe("true");

    await runHeaderEnhancement();

    expect(urlSpy).toHaveBeenCalledTimes(firstRunCalls);
    expect(navItems()[1].classList.contains("a")).toBe(true);
    expect(navItems()[1].querySelector("a")?.getAttribute("aria-current")).toBe("page");
  });

  it("does not rescore after correcting a missing active class on first enhancement", async () => {
    window.history.pushState({}, "", "/forum.php");
    renderHeaderFixture(`<li><a href="/">首页</a></li><li><a href="/forum.php">社区</a></li>`);
    const urlSpy = installUrlSpy();

    await runHeaderEnhancement();
    const firstRunCalls = urlSpy.mock.calls.length;
    expect(navItems()[1].classList.contains("a")).toBe(true);
    expect(navItems()[1].getAttribute("data-chh-lg-active")).toBe("true");

    await runHeaderEnhancement();

    expect(urlSpy).toHaveBeenCalledTimes(firstRunCalls);
    expect(navItems()[1].classList.contains("a")).toBe(true);
    expect(navItems()[1].querySelector("a")?.getAttribute("aria-current")).toBe("page");
  });

  it("rescores when an existing direct nav link href changes", async () => {
    window.history.pushState({}, "", "/portal.php?catid=2");
    renderHeaderFixture(`<li><a href="/">首页</a></li><li><a href="/forum.php">社区</a></li>`);
    const urlSpy = installUrlSpy();

    await runHeaderEnhancement();
    const firstRunCalls = urlSpy.mock.calls.length;
    const items = navItems();
    items[1].querySelector("a")?.setAttribute("href", "/portal.php?catid=2");

    await runHeaderEnhancement();

    expect(urlSpy.mock.calls.length).toBeGreaterThan(firstRunCalls);
    expect(items[0].classList.contains("a")).toBe(false);
    expect(items[0].hasAttribute("data-chh-lg-active")).toBe(false);
    expect(items[1].classList.contains("a")).toBe(true);
    expect(items[1].getAttribute("data-chh-lg-active")).toBe("true");
    expect(items[1].querySelector("a")?.getAttribute("aria-current")).toBe("page");
  });

  it("rescores when a nav item is inserted", async () => {
    window.history.pushState({}, "", "/forum.php");
    renderHeaderFixture(`<li><a href="/">首页</a></li><li class="a"><a href="/forum.php">社区</a></li>`);
    const urlSpy = installUrlSpy();

    await runHeaderEnhancement();
    const firstRunCalls = urlSpy.mock.calls.length;
    document.querySelector("#nv > ul")?.insertAdjacentHTML("beforeend", `<li><a href="/portal.php?catid=2">门户分类</a></li>`);

    await runHeaderEnhancement();

    expect(urlSpy.mock.calls.length).toBeGreaterThan(firstRunCalls);
    expect(navItems()).toHaveLength(3);
    expect(navItems()[1].classList.contains("a")).toBe(true);
  });

  it("rescores when the site flips the active class without changing URL or hrefs", async () => {
    window.history.pushState({}, "", "/plugin.php?id=unknown");
    renderHeaderFixture(`<li class="a"><a href="/forum.php">社区</a></li><li><a href="/portal.php">门户</a></li>`);
    const urlSpy = installUrlSpy();

    await runHeaderEnhancement();
    const firstRunCalls = urlSpy.mock.calls.length;
    const items = navItems();
    items[0].classList.remove("a");
    items[1].classList.add("a");

    await runHeaderEnhancement();

    expect(urlSpy.mock.calls.length).toBeGreaterThan(firstRunCalls);
    expect(items[0].classList.contains("a")).toBe(false);
    expect(items[0].hasAttribute("data-chh-lg-active")).toBe(false);
    expect(items[0].querySelector("a")?.hasAttribute("aria-current")).toBe(false);
    expect(items[1].classList.contains("a")).toBe(true);
    expect(items[1].getAttribute("data-chh-lg-active")).toBe("true");
    expect(items[1].querySelector("a")?.getAttribute("aria-current")).toBe("page");
  });
});
