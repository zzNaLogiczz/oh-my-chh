import { afterEach, describe, expect, it, vi } from "vitest";
import { coverPage, EXCEL_FAVICON, guardFavicon, guardTitle } from "../../src/remake/excel/host/cover";
import { consumeExcelBypass, setExcelBypass } from "../../src/remake/excel/host/bypass";
import { createRequestGate, createHostController } from "../../src/remake/excel/host/controller";
import { fetchExcelPage } from "../../src/remake/excel/host/fetch-page";
import { mountAppFrame } from "../../src/remake/excel/host/frame";
import type { ExcelPage } from "../../src/remake/excel/model";
import type { HostToApp } from "../../src/remake/excel/protocol";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-omchh-excel");
  document.documentElement.removeAttribute("data-omchh-paint-ready");
  document.getElementById("omchh-excel-cover")?.remove();
  document.getElementById("omchh-excel-skeleton")?.remove();
  sessionStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("favicon guard", () => {
  it("lets two guards on one page settle instead of fighting over the icon", async () => {
    // 扩展重载后同一页面可能有两个内容脚本实例；两个守卫互删对方的图标会无限触发 MutationObserver
    // 互删是微任务循环，会饿死定时器；计数观察器超过阈值就在微任务里熔断，测试才不会卡死
    let mutations = 0;
    const stops: Array<() => void> = [];
    const counter = new MutationObserver((records) => {
      mutations += records.length;
      if (mutations > 200) stops.forEach((stop) => stop());
    });
    counter.observe(document.documentElement, { subtree: true, childList: true });
    stops.push(guardFavicon(document), guardFavicon(document));
    await new Promise((resolve) => setTimeout(resolve, 50));
    stops.forEach((stop) => stop());
    counter.disconnect();
    expect(mutations).toBeLessThan(20);
    expect(document.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
  });
});

describe("page cover", () => {
  it("marks the document and hides the original body", () => {
    coverPage(document);
    expect(document.documentElement.dataset.omchhExcel).toBe("1");
    const css = document.getElementById("omchh-excel-cover")?.textContent ?? "";
    expect(css).toContain("display:none");
    expect(document.getElementById("omchh-excel-skeleton")).not.toBeNull();
  });

  it("restores the Excel title whenever the page rewrites it", async () => {
    document.head.innerHTML = "<title>社区 - Chiphell</title>";
    const stop = guardTitle(document, "Q4.xlsx - Excel");
    expect(document.title).toBe("Q4.xlsx - Excel");
    document.querySelector("title")!.textContent = "社区 - Chiphell";
    await vi.waitFor(() => expect(document.title).toBe("Q4.xlsx - Excel"));
    stop();
  });

  it("replaces site favicons with the spreadsheet icon", async () => {
    const stop = guardFavicon(document);
    const link = document.createElement("link");
    link.rel = "shortcut icon";
    link.href = "/favicon.ico";
    document.head.append(link);
    await vi.waitFor(() => expect(link.isConnected).toBe(false));
    const ours = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
    expect(ours).toHaveLength(1);
    expect(ours[0].href.startsWith("data:image/svg+xml")).toBe(true);
    expect(EXCEL_FAVICON.startsWith("data:image/svg+xml")).toBe(true);
    stop();
  });
});

describe("app frame", () => {
  it("mounts a full-viewport iframe pointing at the extension page", () => {
    const { frame } = mountAppFrame(document, "chrome-extension://abc/excel/app.html");
    expect(frame.src).toBe("chrome-extension://abc/excel/app.html");
    expect(frame.style.position).toBe("fixed");
    expect(frame.style.zIndex).toBe("2147483647");
    expect(frame.parentElement).toBe(document.documentElement);
  });
});

describe("bypass", () => {
  it("lets exactly one load of the same URL skip Excel mode", () => {
    setExcelBypass("https://www.chiphell.com/space-uid-2.html");
    expect(consumeExcelBypass("https://www.chiphell.com/forum.php")).toBe(false);
    expect(consumeExcelBypass("https://www.chiphell.com/space-uid-2.html")).toBe(true);
    expect(consumeExcelBypass("https://www.chiphell.com/space-uid-2.html")).toBe(false);
  });
});

describe("fetchExcelPage", () => {
  it("refuses other origins", async () => {
    await expect(fetchExcelPage("https://evil.example/x")).rejects.toThrow();
  });

  it("parses fetched HTML at its final URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, url: "https://www.chiphell.com/forum-283-1.html",
      text: async () => '<div id="messagetext"><p>您需要先登录才能继续本操作</p></div>'
    }));
    const result = await fetchExcelPage("https://www.chiphell.com/forum-283-1.html");
    expect(result.url).toBe("https://www.chiphell.com/forum-283-1.html");
    expect(result.page).toMatchObject({ kind: "notice", reason: "login-required" });
    expect(fetch).toHaveBeenCalledWith("https://www.chiphell.com/forum-283-1.html", { credentials: "include" });
  });
});

describe("request gate", () => {
  it("only honours the latest request", () => {
    const gate = createRequestGate();
    const a = gate.begin();
    const b = gate.begin();
    expect(gate.isLatest(a)).toBe(false);
    expect(gate.isLatest(b)).toBe(true);
  });
});

describe("host controller", () => {
  const pageInfo = { page: 1, totalPages: 1, nextUrl: null, prevUrl: null, pageUrlTemplate: null };
  const listPage: ExcelPage = { kind: "thread-list", fid: "283", forumName: "大恶魔的Blog", threads: [], pageInfo, parent: null };
  const indexPage: ExcelPage = { kind: "forum-index", channels: [], categories: [] };

  function setup(fetchPage: (url: string) => Promise<{ page: ExcelPage; url: string }>) {
    const channel = new MessageChannel();
    const sent: HostToApp[] = [];
    channel.port1.onmessage = (event) => sent.push(event.data as HostToApp);
    // 模拟应用内历史深度：每次 pushState 加一层
    let depth = 0;
    const pushState = vi.fn(() => { depth += 1; });
    const goBack = vi.fn(() => { depth -= 1; });
    const openOriginal = vi.fn();
    const controller = createHostController({
      port: channel.port2,
      fetchPage,
      initialPage: async () => ({ page: indexPage, url: "https://www.chiphell.com/forum.php" }),
      submitReply: vi.fn(),
      pushState,
      canGoBack: () => depth > 0,
      goBack,
      currentUrl: () => "https://www.chiphell.com/forum-283-1.html",
      openOriginal
    });
    const app = (message: unknown) => channel.port1.postMessage(message);
    return { sent, pushState, goBack, openOriginal, controller, app, close: () => { channel.port1.close(); channel.port2.close(); } };
  }

  const pages = (sent: HostToApp[]) => sent.filter((m): m is Extract<HostToApp, { type: "page" }> => m.type === "page");

  it("tells the app whether an in-app back step exists", async () => {
    const t = setup(async (url) => ({ page: listPage, url }));
    t.app({ type: "ready" });
    await vi.waitFor(() => expect(pages(t.sent)).toHaveLength(1));
    expect(pages(t.sent)[0].canBack).toBe(false);
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum-283-1.html", append: false });
    await vi.waitFor(() => expect(pages(t.sent)).toHaveLength(2));
    expect(pages(t.sent)[1].canBack).toBe(true);
    t.close();
  });

  it("goes back through browser history only when the app pushed an entry", async () => {
    const t = setup(async (url) => ({ page: listPage, url }));
    t.app({ type: "back" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(t.goBack).not.toHaveBeenCalled();
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum-283-1.html", append: false });
    await vi.waitFor(() => expect(t.pushState).toHaveBeenCalled());
    t.app({ type: "back" });
    await vi.waitFor(() => expect(t.goBack).toHaveBeenCalledTimes(1));
    t.close();
  });

  it("sends the initial page once the app is ready", async () => {
    const t = setup(vi.fn());
    t.app({ type: "ready" });
    await vi.waitFor(() => expect(t.sent.find((m) => m.type === "page")).toMatchObject({ type: "page", page: indexPage, append: false }));
    t.close();
  });

  it("loads navigation targets and records them in history", async () => {
    const t = setup(async (url) => ({ page: listPage, url }));
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum-283-1.html", append: false });
    await vi.waitFor(() => expect(t.sent.map((m) => m.type)).toEqual(["loading", "page"]));
    expect(t.pushState).toHaveBeenCalledWith("https://www.chiphell.com/forum-283-1.html");
    t.close();
  });

  it("does not push history for appended pages", async () => {
    const t = setup(async (url) => ({ page: listPage, url }));
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum-283-2.html", append: true });
    await vi.waitFor(() => expect(t.sent.some((m) => m.type === "page" && m.append)).toBe(true));
    expect(t.pushState).not.toHaveBeenCalled();
    t.close();
  });

  it("drops stale responses when navigation is clicked twice quickly", async () => {
    let releaseFirst!: () => void;
    const fetchPage = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = () => resolve({ page: indexPage, url: "https://www.chiphell.com/forum.php" }); }))
      .mockImplementationOnce(async () => ({ page: listPage, url: "https://www.chiphell.com/forum-283-1.html" }));
    const t = setup(fetchPage);
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum.php", append: false });
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum-283-1.html", append: false });
    await vi.waitFor(() => expect(t.sent.filter((m) => m.type === "page")).toHaveLength(1));
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const pages = t.sent.filter((m): m is Extract<HostToApp, { type: "page" }> => m.type === "page");
    expect(pages).toHaveLength(1);
    expect(pages[0].page).toEqual(listPage);
    t.close();
  });

  it("reports network failures in plain words", async () => {
    const t = setup(async () => { throw new TypeError("Failed to fetch"); });
    t.app({ type: "navigate", url: "https://www.chiphell.com/forum.php", append: false });
    await vi.waitFor(() => expect(t.sent.find((m) => m.type === "error")).toMatchObject({ message: "无法连接到数据源，请检查网络后重试。" }));
    t.close();
  });

  it("opens the original page through the bypass", async () => {
    const t = setup(vi.fn());
    t.app({ type: "open-original", url: "https://www.chiphell.com/space-uid-2.html" });
    await vi.waitFor(() => expect(t.openOriginal).toHaveBeenCalledWith("https://www.chiphell.com/space-uid-2.html"));
    t.close();
  });

  it("reloads the current URL on popstate without pushing history", async () => {
    const fetchPage = vi.fn(async (url: string) => ({ page: listPage, url }));
    const t = setup(fetchPage);
    t.controller.onPopState();
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledWith("https://www.chiphell.com/forum-283-1.html"));
    await vi.waitFor(() => expect(t.sent.some((m) => m.type === "page")).toBe(true));
    expect(t.pushState).not.toHaveBeenCalled();
    t.close();
  });
});
