import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/preferences/settings";

const waitFor = vi.waitFor;

type SettingsListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

function makeDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("../../src/theming/assets");
  vi.doUnmock("../../src/foundation/semantics");
  vi.doUnmock("../../src/foundation/observer");
  vi.doUnmock("../../src/platform/health");
  vi.doUnmock("../../src/foundation/route");
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-omchh-paint-ready");
  document.documentElement.removeAttribute("data-omchh-density");
  document.documentElement.removeAttribute("data-omchh-motion");
  document.documentElement.removeAttribute("data-omchh-scheme");
  document.documentElement.removeAttribute("data-omchh-route");
  window.history.pushState({}, "", "/");
});

describe("bootstrap refresh drain", () => {

  it("normalizes stored system color scheme to light before first-paint theme assets finish loading", async () => {
    const firstAssetLoad = makeDeferred<boolean>();
    const ensureThemeAssets = vi.fn().mockReturnValue(firstAssetLoad.promise);
    const runSharedAdapters = vi.fn();

    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
      media,
      matches: true,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as unknown as MediaQueryList));

    vi.doMock("../../src/theming/assets", async () => {
      const actual = await vi.importActual<typeof import("../../src/theming/assets")>("../../src/theming/assets");
      return { ...actual, ensureThemeAssets };
    });
    vi.doMock("../../src/foundation/semantics", () => ({ runSharedAdapters }));
    vi.doMock("../../src/foundation/observer", () => ({
      createObserverScheduler: () => ({ start: vi.fn(), stop: vi.fn(), requestRun: vi.fn() })
    }));
    vi.doMock("../../src/platform/health", () => ({ scheduleHealthSave: vi.fn(), trackSelector: vi.fn() }));
    vi.doMock("../../src/foundation/route", async () => {
      const actual = await vi.importActual<typeof import("../../src/foundation/route")>("../../src/foundation/route");
      return { ...actual, detectRoute: vi.fn(() => "thread-detail") };
    });

    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.5" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, colorScheme: "system" })
        },
        local: { set: vi.fn().mockResolvedValue(undefined) },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });

    document.body.innerHTML = `<div id="ct"><div id="postlist"></div></div>`;
    await import("../../src/platform/bootstrap");

    await waitFor(() => expect(ensureThemeAssets).toHaveBeenCalledTimes(1));
    expect(document.documentElement.dataset.omchhScheme).toBe("light");
    expect(document.documentElement.dataset.omchhTheme).toBe("liquid-glass");
    expect(document.documentElement.dataset.omchhPaintReady).toBeUndefined();
    expect(runSharedAdapters).not.toHaveBeenCalled();

    firstAssetLoad.resolve(true);
    document.dispatchEvent(new Event("DOMContentLoaded"));

    await waitFor(() => expect(document.documentElement.dataset.omchhPaintReady).toBe("1"));
    expect(runSharedAdapters).toHaveBeenCalledTimes(1);
  });

  it("keeps normalized light scheme on system color changes without rerunning DOM adapters", async () => {
    const ensureThemeAssets = vi.fn().mockResolvedValue(true);
    const runSharedAdapters = vi.fn();
    const observerRequestRun = vi.fn();
    let prefersDark = false;
    let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;

    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
      media,
      get matches() {
        return prefersDark;
      },
      onchange: null,
      addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === "change") mediaListener = listener;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        mediaListener = listener;
      }),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as unknown as MediaQueryList));

    vi.doMock("../../src/theming/assets", async () => {
      const actual = await vi.importActual<typeof import("../../src/theming/assets")>("../../src/theming/assets");
      return { ...actual, ensureThemeAssets };
    });
    vi.doMock("../../src/foundation/semantics", () => ({ runSharedAdapters }));
    vi.doMock("../../src/foundation/observer", () => ({
      createObserverScheduler: () => ({ start: vi.fn(), stop: vi.fn(), requestRun: observerRequestRun })
    }));
    vi.doMock("../../src/platform/health", () => ({ scheduleHealthSave: vi.fn(), trackSelector: vi.fn() }));
    vi.doMock("../../src/foundation/route", async () => {
      const actual = await vi.importActual<typeof import("../../src/foundation/route")>("../../src/foundation/route");
      return { ...actual, detectRoute: vi.fn(() => "thread-detail") };
    });

    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.5" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, colorScheme: "system" })
        },
        local: { set: vi.fn().mockResolvedValue(undefined) },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });

    document.body.innerHTML = `<div id="ct"><div id="postlist"></div></div>`;
    await import("../../src/platform/bootstrap");

    await waitFor(() => expect(document.documentElement.dataset.omchhPaintReady).toBe("1"));
    expect(document.documentElement.dataset.omchhScheme).toBe("light");
    expect(runSharedAdapters).toHaveBeenCalledTimes(1);
    expect(mediaListener).toBeTypeOf("function");

    prefersDark = true;
    mediaListener?.(new Event("change") as MediaQueryListEvent);

    await waitFor(() => expect(document.documentElement.dataset.omchhScheme).toBe("light"));
    expect(runSharedAdapters).toHaveBeenCalledTimes(1);
    expect(observerRequestRun).not.toHaveBeenCalled();
  });

  it("does not override explicit light or dark choices on system color changes", async () => {
    const ensureThemeAssets = vi.fn().mockResolvedValue(true);
    const runSharedAdapters = vi.fn();
    let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;

    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
      media,
      matches: true,
      onchange: null,
      addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === "change") mediaListener = listener;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        mediaListener = listener;
      }),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as unknown as MediaQueryList));

    vi.doMock("../../src/theming/assets", async () => {
      const actual = await vi.importActual<typeof import("../../src/theming/assets")>("../../src/theming/assets");
      return { ...actual, ensureThemeAssets };
    });
    vi.doMock("../../src/foundation/semantics", () => ({ runSharedAdapters }));
    vi.doMock("../../src/foundation/observer", () => ({
      createObserverScheduler: () => ({ start: vi.fn(), stop: vi.fn(), requestRun: vi.fn() })
    }));
    vi.doMock("../../src/platform/health", () => ({ scheduleHealthSave: vi.fn(), trackSelector: vi.fn() }));
    vi.doMock("../../src/foundation/route", async () => {
      const actual = await vi.importActual<typeof import("../../src/foundation/route")>("../../src/foundation/route");
      return { ...actual, detectRoute: vi.fn(() => "thread-detail") };
    });

    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.5" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, colorScheme: "light" })
        },
        local: { set: vi.fn().mockResolvedValue(undefined) },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      }
    });

    document.body.innerHTML = `<div id="ct"><div id="postlist"></div></div>`;
    await import("../../src/platform/bootstrap");

    await waitFor(() => expect(document.documentElement.dataset.omchhPaintReady).toBe("1"));
    expect(document.documentElement.dataset.omchhScheme).toBe("light");
    expect(mediaListener).toBeTypeOf("function");

    mediaListener?.(new Event("change") as MediaQueryListEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.documentElement.dataset.omchhScheme).toBe("light");
    expect(runSharedAdapters).toHaveBeenCalledTimes(1);
    expect(ensureThemeAssets).toHaveBeenCalledTimes(2);
  });
  it("waits for queued DOM-ready tail refresh before releasing first paint", async () => {
    const firstAssetLoad = makeDeferred<boolean>();
    const laterAssetLoads: Array<ReturnType<typeof makeDeferred<boolean>>> = [];
    const ensureThemeAssets = vi
      .fn()
      .mockReturnValueOnce(firstAssetLoad.promise)
      .mockImplementation(() => {
        const deferred = makeDeferred<boolean>();
        laterAssetLoads.push(deferred);
        return deferred.promise;
      });

    const applyThemeRoot = vi.fn((settings, route) => {
      document.documentElement.dataset.omchhDensity = settings.density;
      document.documentElement.dataset.omchhRoute = route;
    });
    const runSharedAdapters = vi.fn();
    const start = vi.fn();
    let settingsListener: SettingsListener | undefined;

    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    vi.doMock("../../src/theming/assets", async () => {
      const actual = await vi.importActual<typeof import("../../src/theming/assets")>("../../src/theming/assets");
      return { ...actual, ensureThemeAssets, applyThemeRoot };
    });
    vi.doMock("../../src/foundation/semantics", () => ({ runSharedAdapters }));
    vi.doMock("../../src/foundation/observer", () => ({
      createObserverScheduler: () => ({ start, stop: vi.fn(), requestRun: vi.fn() })
    }));
    vi.doMock("../../src/platform/health", () => ({ scheduleHealthSave: vi.fn(), trackSelector: vi.fn() }));
    vi.doMock("../../src/foundation/route", async () => {
      const actual = await vi.importActual<typeof import("../../src/foundation/route")>("../../src/foundation/route");
      return { ...actual, detectRoute: vi.fn(() => "thread-detail") };
    });

    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.5" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, density: "compact" })
        },
        local: {
          set: vi.fn().mockResolvedValue(undefined)
        },
        onChanged: {
          addListener: vi.fn((listener: SettingsListener) => {
            settingsListener = listener;
          }),
          removeListener: vi.fn()
        }
      }
    });

    document.body.innerHTML = `<div id="ct"><div id="postlist"></div></div>`;
    await import("../../src/platform/bootstrap");

    await waitFor(() => expect(ensureThemeAssets).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await waitFor(() => expect(ensureThemeAssets).toHaveBeenCalledTimes(1));

    firstAssetLoad.resolve(true);
    await waitFor(() => expect(ensureThemeAssets).toHaveBeenCalledTimes(2));
    expect(document.documentElement.dataset.omchhPaintReady).toBeUndefined();

    laterAssetLoads[0].resolve(true);
    await waitFor(() => expect(document.documentElement.dataset.omchhPaintReady).toBe("1"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(runSharedAdapters).toHaveBeenCalledTimes(1);
    expect(settingsListener).toBeTypeOf("function");
  });

  it("coalesces settings and observer refresh requests into one active drain plus one tail", async () => {
    const firstAssetLoad = makeDeferred<boolean>();
    const secondAssetLoad = makeDeferred<boolean>();
    const ensureThemeAssets = vi.fn()
      .mockReturnValueOnce(firstAssetLoad.promise)
      .mockReturnValueOnce(secondAssetLoad.promise);
    const applyThemeRoot = vi.fn((settings, route) => {
      document.documentElement.dataset.omchhDensity = settings.density;
      document.documentElement.dataset.omchhRoute = route;
    });
    const runSharedAdapters = vi.fn();
    const observerRequestRun = vi.fn();
    let observerRun: (() => void) | undefined;
    let settingsListener: SettingsListener | undefined;

    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    vi.doMock("../../src/theming/assets", async () => {
      const actual = await vi.importActual<typeof import("../../src/theming/assets")>("../../src/theming/assets");
      return { ...actual, ensureThemeAssets, applyThemeRoot };
    });
    vi.doMock("../../src/foundation/semantics", () => ({ runSharedAdapters }));
    vi.doMock("../../src/foundation/observer", () => ({
      createObserverScheduler: (run: () => void) => {
        observerRun = run;
        return { start: vi.fn(), stop: vi.fn(), requestRun: observerRequestRun };
      }
    }));
    vi.doMock("../../src/platform/health", () => ({ scheduleHealthSave: vi.fn(), trackSelector: vi.fn() }));
    vi.doMock("../../src/foundation/route", async () => {
      const actual = await vi.importActual<typeof import("../../src/foundation/route")>("../../src/foundation/route");
      return { ...actual, detectRoute: vi.fn(() => "thread-detail") };
    });

    const get = vi.fn()
      .mockResolvedValueOnce({ ...DEFAULT_SETTINGS, density: "compact" })
      .mockResolvedValueOnce({ ...DEFAULT_SETTINGS, density: "comfortable" });
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.1.5" }),
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      storage: {
        sync: { get },
        local: { set: vi.fn().mockResolvedValue(undefined) },
        onChanged: {
          addListener: vi.fn((listener: SettingsListener) => {
            settingsListener = listener;
          }),
          removeListener: vi.fn()
        }
      }
    });

    document.body.innerHTML = `<div id="ct"><div id="postlist"></div></div>`;
    await import("../../src/platform/bootstrap");
    await waitFor(() => expect(ensureThemeAssets).toHaveBeenCalledTimes(1));

    settingsListener?.({ density: { oldValue: "compact", newValue: "comfortable" } }, "sync");
    await Promise.resolve();
    observerRun?.();
    await Promise.resolve();

    expect(ensureThemeAssets).toHaveBeenCalledTimes(1);

    firstAssetLoad.resolve(true);
    await waitFor(() => expect(ensureThemeAssets).toHaveBeenCalledTimes(2));
    secondAssetLoad.resolve(true);

    await waitFor(() => {
      expect(document.documentElement.dataset.omchhDensity).toBe("comfortable");
    });
    expect(runSharedAdapters).toHaveBeenCalledTimes(1);
    expect(observerRequestRun).toHaveBeenCalledTimes(1);
  });
});
