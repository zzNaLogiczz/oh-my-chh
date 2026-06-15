import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/preferences/settings";
import { EnhancementScope } from "../../src/platform/enhancement-scope";
import type { OmchhSettings } from "../../src/preferences/settings";

function context(settings: OmchhSettings) {
  return { root: document, route: "thread-detail" as const, settings };
}

async function loadHeaderModule() {
  return import("../../src/theming/themes/liquid-glass/adapter/header");
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("data-chh-lg-scrolled");
  document.documentElement.removeAttribute("data-chh-lg-pressed");
  document.documentElement.style.removeProperty("--chh-lg-pointer-x");
  document.documentElement.style.removeProperty("--chh-lg-pointer-y");
  document.documentElement.style.removeProperty("--chh-pointer-x");
  document.documentElement.style.removeProperty("--chh-pointer-y");
});

describe("Liquid Glass reduced effects", () => {
  it("does not bind pointermove when reduceMotion is enabled", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const { enhanceLiquidGlassHeader } = await loadHeaderModule();

    enhanceLiquidGlassHeader(context({ ...DEFAULT_SETTINGS, reduceMotion: true, reduceGlass: false }), new EnhancementScope());

    expect(add).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    expect(add).not.toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });
  });

  it("removes pointermove and clears pointer variables when switching from interactive to reduced", async () => {
    const listeners = new Map<string, EventListener>();
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      listeners.set(String(type), listener as EventListener);
    });
    const remove = vi.spyOn(window, "removeEventListener");
    const { enhanceLiquidGlassHeader } = await loadHeaderModule();

    enhanceLiquidGlassHeader(context({ ...DEFAULT_SETTINGS, reduceMotion: false, reduceGlass: false }), new EnhancementScope());
    const pointermove = listeners.get("pointermove");
    expect(pointermove).toBeTypeOf("function");

    document.documentElement.style.setProperty("--chh-lg-pointer-x", "10px");
    document.documentElement.style.setProperty("--chh-pointer-y", "20px");

    enhanceLiquidGlassHeader(context({ ...DEFAULT_SETTINGS, reduceMotion: true, reduceGlass: false }), new EnhancementScope());

    expect(remove).toHaveBeenCalledWith("pointermove", pointermove, { passive: true });
    expect(document.documentElement.style.getPropertyValue("--chh-lg-pointer-x")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--chh-pointer-y")).toBe("");
  });

  it("throttles interactive pointer root-style writes before mutating style", async () => {
    vi.useFakeTimers();
    let pointermove: EventListener | undefined;
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "pointermove") pointermove = listener as EventListener;
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      const id = window.setTimeout(() => callback(performance.now()), 0);
      return Number(id);
    });
    const setProperty = vi.spyOn(document.documentElement.style, "setProperty");
    const { enhanceLiquidGlassHeader } = await loadHeaderModule();

    enhanceLiquidGlassHeader(context({ ...DEFAULT_SETTINGS, reduceMotion: false, reduceGlass: false }), new EnhancementScope());
    expect(pointermove).toBeTypeOf("function");

    for (let index = 0; index < 100; index += 1) {
      pointermove?.(new MouseEvent("pointermove", { clientX: index, clientY: index }));
      vi.advanceTimersByTime(10);
    }
    vi.runOnlyPendingTimers();

    const pointerUpdateBatches = setProperty.mock.calls.filter(([name]) => name === "--chh-lg-pointer-x");
    expect(pointerUpdateBatches.length).toBeLessThanOrEqual(10);
  });
});
