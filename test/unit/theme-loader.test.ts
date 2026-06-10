import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme } from "../../src/content/theme-loader";
import { DEFAULT_SETTINGS } from "../../src/content/settings";

afterEach(() => {
  document.documentElement.removeAttribute("data-omchh-enabled");
  document.documentElement.removeAttribute("data-omchh-route");
  document.documentElement.removeAttribute("data-omchh-theme");
  document.documentElement.removeAttribute("data-omchh-density");
  document.documentElement.removeAttribute("data-omchh-reduce-glass");
  document.documentElement.removeAttribute("data-omchh-motion");
  document.head.innerHTML = "";
  document.documentElement.classList.remove("chh-liquid-glass");
  document.body.classList.remove("chh-liquid-glass");
  vi.unstubAllGlobals();
});

describe("applyTheme", () => {
  it("uses manifest-injected theme CSS and updates root attributes", () => {
    document.head.innerHTML = `<link id="omchh-theme-css" rel="stylesheet" data-omchh-managed="theme" href="chrome-extension://old/themes/liquid-glass/index.css" />`;

    applyTheme(DEFAULT_SETTINGS, "forum-index");
    applyTheme({ ...DEFAULT_SETTINGS, themeId: "liquid-glass", reduceGlass: true, density: "comfortable" }, "thread-list");

    expect(document.querySelector("link#omchh-theme-css")).toBeNull();
    expect(document.documentElement.dataset.omchhEnabled).toBe("1");
    expect(document.documentElement.dataset.omchhRoute).toBe("thread-list");
    expect(document.documentElement.dataset.omchhTheme).toBe("liquid-glass");
    expect(document.documentElement.dataset.omchhReduceGlass).toBe("1");
    expect(document.documentElement.dataset.omchhDensity).toBe("comfortable");
    expect(document.documentElement.classList.contains("chh-liquid-glass")).toBe(true);
    expect(document.body.classList.contains("chh-liquid-glass")).toBe(true);
  });

  it("does not throw when Chrome invalidates the extension context", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: () => {
          throw new Error("Extension context invalidated.");
        }
      }
    });

    expect(() => applyTheme(DEFAULT_SETTINGS, "forum-index")).not.toThrow();
    expect(document.documentElement.dataset.omchhTheme).toBe("liquid-glass");
    expect(document.querySelector("link#omchh-theme-css")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not throw or warn when the runtime getter is invalidated", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const chrome = {};
    Object.defineProperty(chrome, "runtime", {
      get: () => {
        throw new Error("Extension context invalidated.");
      }
    });
    vi.stubGlobal("chrome", chrome);

    expect(() => applyTheme(DEFAULT_SETTINGS, "thread-detail")).not.toThrow();
    expect(document.documentElement.dataset.omchhRoute).toBe("thread-detail");
    expect(document.querySelector("link#omchh-theme-css")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
