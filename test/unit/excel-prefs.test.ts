import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_EXCEL_PREFS,
  EXCEL_PREFS_KEY,
  excelWindowTitle,
  loadExcelPrefs,
  normalizeExcelPrefs,
  saveExcelPrefs
} from "../../src/remake/excel/prefs";

function installLocalStorageStub(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (items: Record<string, unknown>) => Object.assign(store, items)
      }
    }
  };
  return store;
}

afterEach(() => {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
});

describe("excel prefs", () => {
  it("falls back to defaults for invalid fields", () => {
    expect(normalizeExcelPrefs({ displayName: "", bossKey: 1 })).toEqual(DEFAULT_EXCEL_PREFS);
    expect(normalizeExcelPrefs(undefined)).toEqual(DEFAULT_EXCEL_PREFS);
    expect(normalizeExcelPrefs({ imagesDefault: "maybe" }).imagesDefault).toBe("show");
    expect(normalizeExcelPrefs({ imagesDefault: "hide" }).imagesDefault).toBe("hide");
  });

  it("caps display names at 120 characters", () => {
    expect(normalizeExcelPrefs({ displayName: "x".repeat(200) }).displayName).toHaveLength(120);
  });

  it("formats the window title like Excel", () => {
    expect(excelWindowTitle({ ...DEFAULT_EXCEL_PREFS, displayName: "Q4 对账.xlsx" })).toBe("Q4 对账.xlsx - Excel");
  });

  it("returns defaults when chrome storage is unavailable", async () => {
    await expect(loadExcelPrefs()).resolves.toEqual(DEFAULT_EXCEL_PREFS);
  });

  it("round-trips prefs through chrome.storage.local", async () => {
    const store = installLocalStorageStub();
    await saveExcelPrefs({ ...DEFAULT_EXCEL_PREFS, displayName: "预算.xlsx", imagesDefault: "hide" });
    expect(store[EXCEL_PREFS_KEY]).toMatchObject({ displayName: "预算.xlsx" });
    await expect(loadExcelPrefs()).resolves.toMatchObject({ displayName: "预算.xlsx", imagesDefault: "hide" });
  });
});
