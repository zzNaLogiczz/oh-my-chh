import { afterEach, describe, expect, it, vi } from "vitest";

const waitFor = vi.waitFor;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("../../src/theming/catalog");
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-omchh-enabled");
  document.documentElement.removeAttribute("data-omchh-route");
  document.documentElement.removeAttribute("data-omchh-theme");
  document.documentElement.removeAttribute("data-omchh-paint-ready");
  document.documentElement.className = "";
  document.body.className = "";
  window.history.pushState({}, "", "/");
});

describe("first paint guard", () => {
  it("injects only the shared preflight guard as document_start content CSS", () => {
    const manifest = JSON.parse(readProjectFile("manifest.json"));
    const contentScript = manifest.content_scripts[0];

    expect(contentScript.run_at).toBe("document_start");
    expect(contentScript.css).toEqual(["content/preflight.css"]);
    expect(contentScript.js).toEqual(["content/main.js"]);
    expect(manifest.web_accessible_resources[0].resources).toEqual(
      expect.arrayContaining(["themes/*/index.css", "themes/*/preflight.css", "themes/*/fonts/*"])
    );
  });

  it("preflight hides Chiphell body until the optimized UI is paint-ready", () => {
    const css = readProjectFile("src/platform/preflight.css");

    expect(css).toContain('html:not([data-omchh-paint-ready="1"]) body');
    expect(css).toContain('html[data-omchh-paint-ready="1"] body');
    expect(css).toContain("visibility: hidden !important");
    expect(css).not.toContain("opacity: 0");
  });


  it("does not duplicate pending theme links when early and DOM-ready refresh overlap", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.5" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ themeId: "liquid-glass", density: "comfortable" })
        },
        local: {
          set: vi.fn().mockResolvedValue(undefined)
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });

    window.history.pushState({}, "", "/thread-123-1-1.html");
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist"></div>
        <div id="f_pst"><form id="fastpostform"><textarea id="fastpostmessage">draft</textarea></form></div>
      </div>
    `;

    await import("../../src/platform/bootstrap");

    await waitFor(() => {
      expect(document.querySelector("link#omchh-theme-preflight")).not.toBeNull();
      expect(document.querySelector("link#omchh-theme-css")).not.toBeNull();
    });

    vi.advanceTimersByTime(801);
    await Promise.resolve();

    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await Promise.resolve();

    expect(document.querySelectorAll("link#omchh-theme-preflight")).toHaveLength(1);
    expect(document.querySelectorAll("link#omchh-theme-css")).toHaveLength(1);

    document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight")?.dispatchEvent(new Event("load"));
    document.querySelector<HTMLLinkElement>("link#omchh-theme-css")?.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(document.documentElement.dataset.omchhPaintReady).toBe("1");
    });
  });

  it("loads theme assets before DOMContentLoaded without running adapters or releasing paint", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.4" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ themeId: "liquid-glass", density: "comfortable" })
        },
        local: {
          set: vi.fn().mockResolvedValue(undefined)
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });

    window.history.pushState({}, "", "/thread-123-1-1.html");
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist"></div>
        <div id="f_pst"><form id="fastpostform"><textarea id="fastpostmessage">draft</textarea></form></div>
      </div>
    `;

    await import("../../src/platform/bootstrap");

    await waitFor(() => {
      expect(document.querySelector("link#omchh-theme-preflight")).not.toBeNull();
      expect(document.querySelector("link#omchh-theme-css")).not.toBeNull();
    });

    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(false);
    expect(document.documentElement.dataset.omchhPaintReady).toBeUndefined();

    document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight")?.dispatchEvent(new Event("load"));
    document.querySelector<HTMLLinkElement>("link#omchh-theme-css")?.dispatchEvent(new Event("load"));
    await Promise.resolve();

    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(false);
    expect(document.documentElement.dataset.omchhPaintReady).toBeUndefined();

    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    await waitFor(() => {
      expect(document.documentElement.dataset.omchhPaintReady).toBe("1");
    });
    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(true);
  });

  it("aborts theme refresh after reload fallback is requested", async () => {
    const liquidGlass = {
      id: "liquid-glass",
      name: "Liquid Glass",
      version: "0.1.4",
      description: "Liquid Glass",
      entrypoints: {
        index: "./index.css",
        preflight: "./preflight.css"
      },
      tokens: {},
      capabilities: {
        scopedSelectors: true,
        crossThemeImports: false,
        responsive: true,
        reducedMotion: true,
        requiresReloadOnSwitch: true,
        legacyRootClass: "chh-liquid-glass"
      }
    };
    const flatClean = {
      ...liquidGlass,
      id: "flat-clean",
      name: "Flat Clean",
      capabilities: {
        ...liquidGlass.capabilities,
        requiresReloadOnSwitch: false,
        legacyRootClass: "chh-flat-clean"
      }
    };
    const catalog = [liquidGlass, flatClean];
    vi.doMock("../../src/theming/catalog", () => ({
      DEFAULT_THEME_ID: "liquid-glass",
      THEME_CATALOG: catalog,
      THEME_IDS: catalog.map((theme) => theme.id),
      getThemeMetadata: (id: string) => catalog.find((theme) => theme.id === id),
      isKnownThemeId: (value: unknown) => typeof value === "string" && catalog.some((theme) => theme.id === value)
    }));

    let settingsListener: ((changes: Record<string, unknown>, areaName: string) => void) | undefined;
    const get = vi.fn()
      .mockResolvedValueOnce({ themeId: "flat-clean", density: "comfortable" })
      .mockResolvedValueOnce({ themeId: "liquid-glass", density: "comfortable" });
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.4" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: { get },
        local: {
          set: vi.fn().mockResolvedValue(undefined)
        },
        onChanged: {
          addListener: vi.fn((listener: typeof settingsListener) => {
            settingsListener = listener;
          }),
          removeListener: vi.fn()
        }
      }
    });

    window.history.pushState({}, "", "/thread-123-1-1.html");
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist"></div>
        <div id="f_pst"><form id="fastpostform"><textarea id="fastpostmessage">draft</textarea></form></div>
      </div>
    `;

    await import("../../src/platform/bootstrap");
    await waitFor(() => {
      expect(document.querySelector("link#omchh-theme-preflight")).not.toBeNull();
      expect(document.querySelector("link#omchh-theme-css")).not.toBeNull();
    });
    document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight")?.dispatchEvent(new Event("load"));
    document.querySelector<HTMLLinkElement>("link#omchh-theme-css")?.dispatchEvent(new Event("load"));
    await waitFor(() => {
      expect(document.documentElement.dataset.omchhTheme).toBe("flat-clean");
    });

    settingsListener?.({ themeId: { oldValue: "flat-clean", newValue: "liquid-glass" } }, "sync");

    await waitFor(() => {
      expect(get).toHaveBeenCalledTimes(2);
    });
    await Promise.resolve();

    expect(document.querySelector('link[href*="liquid-glass"]')).toBeNull();
    expect(document.documentElement.dataset.omchhTheme).toBe("flat-clean");
  });

  it("awaits stored settings and theme assets before adapters run or first paint releases", async () => {
    let resolveSettings: ((value: Record<string, unknown>) => void) | undefined;
    const settingsPromise = new Promise<Record<string, unknown>>((resolve) => {
      resolveSettings = resolve;
    });
    const storageSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.3" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn(() => settingsPromise)
        },
        local: {
          set: storageSet
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });

    window.history.pushState({}, "", "/thread-123-1-1.html");
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist"></div>
        <div id="f_pst"><form id="fastpostform"><textarea id="fastpostmessage">draft</textarea></form></div>
      </div>
    `;

    await import("../../src/platform/bootstrap");

    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(false);
    expect(document.documentElement.dataset.omchhPaintReady).toBeUndefined();

    resolveSettings?.({ themeId: "liquid-glass", density: "comfortable" });

    await waitFor(() => {
      expect(document.querySelector("link#omchh-theme-preflight")).not.toBeNull();
      expect(document.querySelector("link#omchh-theme-css")).not.toBeNull();
    });

    document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight")?.dispatchEvent(new Event("load"));
    document.querySelector<HTMLLinkElement>("link#omchh-theme-css")?.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(document.documentElement.dataset.omchhPaintReady).toBe("1");
    });

    expect(document.documentElement.dataset.omchhTheme).toBe("liquid-glass");
    expect(document.documentElement.dataset.omchhRoute).toBe("thread-detail");
    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(true);
  });
});
