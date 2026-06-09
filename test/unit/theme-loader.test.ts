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
  it("keeps exactly one managed theme stylesheet and updates root attributes", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.3" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      }
    });

    applyTheme(DEFAULT_SETTINGS, "forum-index");
    applyTheme({ ...DEFAULT_SETTINGS, themeId: "liquid-glass", reduceGlass: true, density: "comfortable" }, "thread-list");

    const links = document.querySelectorAll<HTMLLinkElement>("link#omchh-theme-css");
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("chrome-extension://test/themes/liquid-glass/index.css?omchh_theme_v=0.1.3");
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
