import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged } from "../../src/preferences/settings";

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

describe("theme setting validation", () => {
  it("defaults color scheme to explicit light mode", () => {
    expect(DEFAULT_SETTINGS.colorScheme).toBe("light");
  });

  it("keeps known theme IDs and falls back to the catalog default for unknown IDs", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ themeId: "liquid-glass", density: "comfortable" })
      .mockResolvedValueOnce({ themeId: "unknown-theme", density: "comfortable" });

    vi.stubGlobal("chrome", {
      storage: {
        sync: { get }
      }
    });

    await expect(loadSettings()).resolves.toMatchObject({ themeId: "liquid-glass", density: "comfortable", colorScheme: "light" });
    await expect(loadSettings()).resolves.toMatchObject({ themeId: DEFAULT_SETTINGS.themeId, density: "comfortable", colorScheme: "light" });
  });
});
