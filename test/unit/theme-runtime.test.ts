import { afterEach, describe, expect, it, vi } from "vitest";
import { applyThemeRoot, ensureThemeAssets } from "../../src/theming/assets";
import { DEFAULT_SETTINGS } from "../../src/preferences/settings";

function stubSystemColorScheme(matches: boolean): void {
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
    media,
    matches,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  })));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-omchh-enabled");
  document.documentElement.removeAttribute("data-omchh-route");
  document.documentElement.removeAttribute("data-omchh-theme");
  document.documentElement.removeAttribute("data-omchh-density");
  document.documentElement.removeAttribute("data-omchh-reduce-glass");
  document.documentElement.removeAttribute("data-omchh-motion");
  document.documentElement.removeAttribute("data-omchh-scheme");
  document.head.innerHTML = "";
  document.documentElement.classList.remove("chh-liquid-glass");
  document.body.classList.remove("chh-liquid-glass");
});

describe("theme runtime", () => {
  it("updates root attributes and metadata-driven legacy classes", () => {
    applyThemeRoot(DEFAULT_SETTINGS, "forum-index");
    applyThemeRoot({ ...DEFAULT_SETTINGS, reduceGlass: true, density: "comfortable" }, "thread-list");

    expect(document.documentElement.dataset.omchhEnabled).toBe("1");
    expect(document.documentElement.dataset.omchhRoute).toBe("thread-list");
    expect(document.documentElement.dataset.omchhTheme).toBe("liquid-glass");
    expect(document.documentElement.dataset.omchhReduceGlass).toBe("1");
    expect(document.documentElement.dataset.omchhDensity).toBe("comfortable");
    expect(document.documentElement.dataset.omchhScheme).toBe("light");
    applyThemeRoot({ ...DEFAULT_SETTINGS, colorScheme: "dark" }, "forum-index");
    expect(document.documentElement.dataset.omchhScheme).toBe("dark");
    expect(document.documentElement.dataset.omchhTheme).toBe("liquid-glass");
    expect(document.documentElement.classList.contains("chh-liquid-glass")).toBe(true);
    expect(document.body.classList.contains("chh-liquid-glass")).toBe(true);
  });


  it("resolves system color scheme before writing root capability attributes", () => {
    stubSystemColorScheme(false);
    applyThemeRoot({ ...DEFAULT_SETTINGS, colorScheme: "system" }, "forum-index");
    expect(document.documentElement.dataset.omchhScheme).toBe("light");

    stubSystemColorScheme(true);
    applyThemeRoot({ ...DEFAULT_SETTINGS, colorScheme: "system" }, "forum-index");
    expect(document.documentElement.dataset.omchhScheme).toBe("dark");

    stubSystemColorScheme(true);
    applyThemeRoot({ ...DEFAULT_SETTINGS, colorScheme: "light" }, "forum-index");
    expect(document.documentElement.dataset.omchhScheme).toBe("light");

    stubSystemColorScheme(false);
    applyThemeRoot({ ...DEFAULT_SETTINGS, colorScheme: "dark" }, "forum-index");
    expect(document.documentElement.dataset.omchhScheme).toBe("dark");
  });

  it("creates managed preflight and theme links and waits for load", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`
      }
    });

    const loaded = ensureThemeAssets("liquid-glass", { blockFirstPaint: true });
    const preflight = document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight");
    const theme = document.querySelector<HTMLLinkElement>("link#omchh-theme-css");

    expect(preflight?.href).toBe("chrome-extension://test/themes/liquid-glass/preflight.css");
    expect(theme?.href).toBe("chrome-extension://test/themes/liquid-glass/index.css");
    expect(preflight?.dataset.omchhManaged).toBe("theme");
    expect(theme?.dataset.omchhManaged).toBe("theme");

    preflight?.dispatchEvent(new Event("load"));
    theme?.dispatchEvent(new Event("load"));

    await expect(loaded).resolves.toBe(true);
    expect(preflight?.dataset.omchhLoaded).toBe("1");
    expect(theme?.dataset.omchhLoaded).toBe("1");
  });

  it("releases first paint after timeout when CSS does not load", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`
      }
    });

    const loaded = ensureThemeAssets("liquid-glass", { blockFirstPaint: true });
    vi.advanceTimersByTime(801);

    await expect(loaded).resolves.toBe(false);
  });

  it("reuses pending theme links after first-paint timeout and marks the original link loaded", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`
      }
    });

    const first = ensureThemeAssets("liquid-glass", { blockFirstPaint: true });
    const preflight = document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight");
    const theme = document.querySelector<HTMLLinkElement>("link#omchh-theme-css");

    vi.advanceTimersByTime(801);
    await expect(first).resolves.toBe(false);

    const second = ensureThemeAssets("liquid-glass", { blockFirstPaint: true });

    expect(document.querySelectorAll("link#omchh-theme-preflight")).toHaveLength(1);
    expect(document.querySelectorAll("link#omchh-theme-css")).toHaveLength(1);
    expect(document.querySelector("link#omchh-theme-preflight")).toBe(preflight);
    expect(document.querySelector("link#omchh-theme-css")).toBe(theme);

    preflight?.dispatchEvent(new Event("load"));
    theme?.dispatchEvent(new Event("load"));

    await expect(second).resolves.toBe(true);
    expect(preflight?.dataset.omchhLoaded).toBe("1");
    expect(theme?.dataset.omchhLoaded).toBe("1");
  });

  it("keeps the old theme link until a replacement href really loads", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`
      }
    });

    const initial = ensureThemeAssets("liquid-glass", { blockFirstPaint: true });
    document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight")?.dispatchEvent(new Event("load"));
    document.querySelector<HTMLLinkElement>("link#omchh-theme-css")?.dispatchEvent(new Event("load"));
    await expect(initial).resolves.toBe(true);

    const oldTheme = document.querySelector<HTMLLinkElement>("link#omchh-theme-css");
    const replacement = ensureThemeAssets("flat-clean", { blockFirstPaint: true });
    const linksDuringReplacement = [...document.querySelectorAll<HTMLLinkElement>("link#omchh-theme-css")];
    const newTheme = linksDuringReplacement.find((link) => link !== oldTheme);

    expect(linksDuringReplacement).toHaveLength(2);
    expect(oldTheme?.isConnected).toBe(true);
    expect(newTheme?.href).toBe("chrome-extension://test/themes/flat-clean/index.css");

    document.querySelector<HTMLLinkElement>("link#omchh-theme-preflight[href$='flat-clean/preflight.css']")?.dispatchEvent(new Event("load"));
    newTheme?.dispatchEvent(new Event("error"));

    await expect(replacement).resolves.toBe(false);
    expect(oldTheme?.isConnected).toBe(true);
    expect(newTheme?.isConnected).toBe(false);
  });

  it("does not throw when Chrome invalidates the extension context", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: () => {
          throw new Error("Extension context invalidated.");
        }
      }
    });

    await expect(ensureThemeAssets("liquid-glass", { blockFirstPaint: true })).resolves.toBe(false);
    expect(document.querySelector("link#omchh-theme-css")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
