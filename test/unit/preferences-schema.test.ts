import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEYS, normalizeSettings } from "../../src/preferences/schema";

describe("preferences schema", () => {
  it("centralizes flat defaults and settings keys", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      themeId: "liquid-glass",
      density: "compact",
      reduceGlass: false,
      reduceMotion: true,
      enhanceQuickReply: true,
      colorScheme: "light"
    });
    expect(SETTINGS_KEYS).toEqual([
      "themeId",
      "density",
      "reduceGlass",
      "reduceMotion",
      "enhanceQuickReply",
      "colorScheme"
    ]);
  });

  it("normalizes unknown values against additive defaults", () => {
    expect(normalizeSettings({ themeId: "missing", density: "wide", reduceMotion: "yes", colorScheme: "dark" })).toMatchObject({
      themeId: "liquid-glass",
      density: "compact",
      reduceMotion: true,
      colorScheme: "light"
    });
    expect(normalizeSettings({ colorScheme: "system" })).toMatchObject({ colorScheme: "light" });
    expect(normalizeSettings({ colorScheme: "sepia" })).toMatchObject({ colorScheme: "light" });
  });

  it("does not expose retired settings as normalized preferences", () => {
    const settings = normalizeSettings({ hideUbbEmoji: true });

    expect(SETTINGS_KEYS).not.toContain("hideUbbEmoji" as never);
    expect(settings).not.toHaveProperty("hideUbbEmoji");
  });
});
