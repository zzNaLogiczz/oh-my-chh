import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleHealthSave, trackSelector } from "../../src/platform/health";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("selector health", () => {
  it("stores popup-readable local selector health summary", async () => {
    vi.useFakeTimers();
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      storage: {
        local: { set }
      }
    });

    trackSelector("thread-list", "#threadlist", 1, true);
    trackSelector("thread-list", "#missing", 0, true);
    scheduleHealthSave("thread-list");
    await vi.advanceTimersByTimeAsync(300);

    expect(set).toHaveBeenCalledTimes(1);
    const payload = set.mock.calls[0][0]["omchh:lastHealth"];
    expect(payload.route).toBe("thread-list");
    expect(payload.hitCount).toBeGreaterThanOrEqual(1);
    expect(payload.missingCount).toBeGreaterThanOrEqual(1);
    expect(payload.missingSelectors).toContain("#missing");
  });

  it("does not throw when Chrome invalidates local storage before the delayed save", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          set: () => {
            throw new Error("Extension context invalidated.");
          }
        }
      }
    });

    trackSelector("forum-index", "#wp", 1, true);
    scheduleHealthSave("forum-index");

    await vi.advanceTimersByTimeAsync(300);
    expect(warn).not.toHaveBeenCalled();
    expect(true).toBe(true);
  });

  it("does not throw or warn when the storage getter is invalidated before scheduling", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const chrome = {};
    Object.defineProperty(chrome, "storage", {
      get: () => {
        throw new Error("Extension context invalidated.");
      }
    });
    vi.stubGlobal("chrome", chrome);

    expect(() => scheduleHealthSave("thread-detail")).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
