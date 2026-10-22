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

describe("loading stored settings", () => {
  it("reads the retired displayMode key so existing Excel users land on the Excel skin", async () => {
    const get = vi.fn().mockResolvedValue({ displayMode: "excel" });
    vi.stubGlobal("chrome", { storage: { sync: { get } } });

    await expect(loadSettings()).resolves.toEqual({ skin: "excel", debugLog: false });
    expect(get.mock.calls[0][0]).toEqual(expect.arrayContaining(["skin", "debugLog", "displayMode"]));
  });

  it("notifies subscribers only for current settings keys", async () => {
    const listeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];
    vi.stubGlobal("chrome", {
      storage: {
        sync: { get: vi.fn().mockResolvedValue({ skin: "excel" }) },
        onChanged: { addListener: (fn: never) => listeners.push(fn), removeListener: vi.fn() }
      }
    });
    const callback = vi.fn();
    onSettingsChanged(callback);
    listeners[0]({ reduceGlass: { newValue: true } }, "sync");
    listeners[0]({ skin: { newValue: "excel" } }, "local");
    expect(callback).not.toHaveBeenCalled();
    listeners[0]({ skin: { newValue: "excel" } }, "sync");
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ skin: "excel", debugLog: false }));
  });
});
