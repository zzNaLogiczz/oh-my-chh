import { afterEach, describe, expect, it, vi } from "vitest";

function stubChrome(sync: Record<string, unknown>) {
  vi.stubGlobal("chrome", {
    runtime: { getManifest: () => ({ version: "0.3.0" }), getURL: (path: string) => `chrome-extension://test/${path}` },
    storage: {
      sync: { get: vi.fn().mockResolvedValue(sync) },
      local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  });
}

const paintReady = () => document.documentElement.dataset.omchhPaintReady;
const excelFrame = () => document.querySelector('iframe[src="chrome-extension://test/excel/app.html"]');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.querySelectorAll("iframe, #omchh-excel-cover, #omchh-excel-skeleton").forEach((node) => node.remove());
  document.documentElement.removeAttribute("data-omchh-paint-ready");
  document.documentElement.removeAttribute("data-omchh-excel");
  sessionStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("content script bootstrap", () => {
  it("leaves the original site untouched and releases the first-paint guard", async () => {
    stubChrome({ skin: "original" });
    window.history.pushState({}, "", "/forum.php");
    await import("../../src/platform/bootstrap");
    await vi.waitFor(() => expect(paintReady()).toBe("1"));
    expect(document.documentElement.dataset.omchhExcel).toBeUndefined();
    expect(excelFrame()).toBeNull();
  });

  it("hands the whole page to the Excel skin and never releases the guard", async () => {
    stubChrome({ skin: "excel" });
    window.history.pushState({}, "", "/forum.php");
    await import("../../src/platform/bootstrap");
    await vi.waitFor(() => expect(excelFrame()).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(paintReady()).toBeUndefined();
    expect(document.documentElement.dataset.omchhExcel).toBe("1");
  });

  it("keeps users of the retired Excel switch on the Excel skin", async () => {
    stubChrome({ displayMode: "excel" });
    await import("../../src/platform/bootstrap");
    await vi.waitFor(() => expect(document.documentElement.dataset.omchhExcel).toBe("1"));
  });

  it("shows the original page once after “open original” even on the Excel skin", async () => {
    stubChrome({ skin: "excel" });
    window.history.pushState({}, "", "/thread-1-1-1.html");
    sessionStorage.setItem("omchh-excel-bypass", window.location.href);
    await import("../../src/platform/bootstrap");
    await vi.waitFor(() => expect(paintReady()).toBe("1"));
    expect(excelFrame()).toBeNull();
  });
});
