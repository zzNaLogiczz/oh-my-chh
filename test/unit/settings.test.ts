import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged } from "../../src/content/settings";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings subscription", () => {
  it("falls back to defaults without warning when the storage getter is invalidated", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const chrome = {};
    Object.defineProperty(chrome, "storage", {
      get: () => {
        throw new Error("Extension context invalidated.");
      }
    });
    vi.stubGlobal("chrome", chrome);

    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not throw when Chrome invalidates storage listeners", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("chrome", {
      storage: {
        onChanged: {
          addListener: () => {
            throw new Error("Extension context invalidated.");
          },
          removeListener: () => {
            throw new Error("Extension context invalidated.");
          }
        }
      }
    });

    const unsubscribe = onSettingsChanged(() => undefined);

    expect(() => unsubscribe()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
