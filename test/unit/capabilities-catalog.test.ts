import { describe, expect, it } from "vitest";
import { CAPABILITY_CATALOG, CAPABILITY_SETTING_KEYS } from "../../src/capabilities/catalog";

describe("capability catalog", () => {
  it("models only root signal settings as pure metadata", () => {
    const settingKeys = CAPABILITY_CATALOG.map((cap) => String(cap.settingKey));

    expect(CAPABILITY_SETTING_KEYS).toEqual(["density", "reduceGlass", "reduceMotion", "colorScheme"]);
    expect(CAPABILITY_CATALOG.map((cap) => cap.rootAttr)).toEqual([
      "data-omchh-density",
      "data-omchh-reduce-glass",
      "data-omchh-motion",
      "data-omchh-scheme"
    ]);
    expect(settingKeys).not.toContain("hideUbbEmoji");
    expect(settingKeys).not.toContain("enhanceQuickReply");
    expect(CAPABILITY_CATALOG.every((cap) => (cap as { hasBehavior?: boolean }).hasBehavior !== true)).toBe(true);
  });

  it("maps settings into stable root attribute values", () => {
    const byKey = Object.fromEntries(CAPABILITY_CATALOG.map((cap) => [cap.settingKey, cap]));
    expect(byKey.density.toAttr("comfortable")).toBe("comfortable");
    expect(byKey.reduceGlass.toAttr(true)).toBe("1");
    expect(byKey.reduceMotion.toAttr(true)).toBe("reduce");
    expect(byKey.colorScheme.toAttr("dark")).toBe("dark");
    expect(byKey.colorScheme.toAttr("light")).toBe("light");
    // Runtime `system` resolution belongs to Theming/Platform, not the pure catalog.
  });

  it("exposes localized color scheme choices without runtime system resolution", () => {
    const colorScheme = CAPABILITY_CATALOG.find((cap) => cap.settingKey === "colorScheme");

    expect(colorScheme?.control).toEqual({
      type: "select",
      label: "色彩模式",
      description: "选择浅色、深色，或自动跟随系统明暗模式。",
      options: [
        { value: "system", label: "自动跟随系统" },
        { value: "light", label: "浅色" },
        { value: "dark", label: "深色" }
      ]
    });
  });
});
