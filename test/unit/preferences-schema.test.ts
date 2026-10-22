import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, LEGACY_SETTINGS_KEYS, SETTINGS_KEYS, normalizeSettings } from "../../src/preferences/schema";

describe("preferences schema", () => {
  it("keeps only the skin choice and the debug log switch", () => {
    expect(DEFAULT_SETTINGS).toEqual({ skin: "original", debugLog: false });
    expect(SETTINGS_KEYS).toEqual(["skin", "debugLog"]);
  });

  it("accepts the two known skins and falls back to the original site otherwise", () => {
    expect(normalizeSettings({ skin: "excel" }).skin).toBe("excel");
    expect(normalizeSettings({ skin: "original" }).skin).toBe("original");
    expect(normalizeSettings({ skin: "liquid-glass" }).skin).toBe("original");
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates the retired Excel display mode switch to the Excel skin", () => {
    expect(normalizeSettings({ displayMode: "excel" }).skin).toBe("excel");
    expect(normalizeSettings({ displayMode: "standard", themeId: "liquid-glass" }).skin).toBe("original");
    // 新字段一旦写过就以它为准
    expect(normalizeSettings({ skin: "original", displayMode: "excel" }).skin).toBe("original");
  });

  it("lists every retired key so saving can clean them out of sync storage", () => {
    expect(LEGACY_SETTINGS_KEYS).toEqual(
      expect.arrayContaining(["displayMode", "themeId", "density", "reduceGlass", "reduceMotion", "enhanceQuickReply", "colorScheme"])
    );
    expect(normalizeSettings({ debugLog: true, reduceGlass: true })).toEqual({ skin: "original", debugLog: true });
  });
});
