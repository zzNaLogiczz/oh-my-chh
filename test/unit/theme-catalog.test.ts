import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getThemeMetadata, isKnownThemeId, THEME_CATALOG, THEME_IDS } from "../../src/theming/catalog";

describe("theme catalog", () => {
  it("exposes shipped themes as pure metadata with preflight and reload capability", () => {
    expect(DEFAULT_THEME_ID).toBe("liquid-glass");
    expect(THEME_IDS).toEqual(["liquid-glass", "flat-clean"]);
    expect(THEME_CATALOG).toHaveLength(2);

    const liquidGlass = getThemeMetadata("liquid-glass");
    expect(liquidGlass?.name).toBe("Liquid Glass");
    expect(liquidGlass?.entrypoints.index).toBe("./index.css");
    expect(liquidGlass?.entrypoints.preflight).toBe("./preflight.css");
    expect(liquidGlass?.capabilities.requiresReloadOnSwitch).toBe(true);
    expect(liquidGlass?.capabilities.legacyRootClass).toBe("chh-liquid-glass");

    const flatClean = getThemeMetadata("flat-clean");
    expect(flatClean?.name).toBe("Flat Clean");
    expect(flatClean?.entrypoints.index).toBe("./index.css");
    expect(flatClean?.entrypoints.preflight).toBe("./preflight.css");
    expect(flatClean?.capabilities.requiresReloadOnSwitch).toBe(false);
  });

  it("recognizes known theme IDs and rejects unknown values", () => {
    expect(isKnownThemeId("liquid-glass")).toBe(true);
    expect(isKnownThemeId("flat-clean")).toBe(true);
    expect(isKnownThemeId("aurora")).toBe(false);
    expect(isKnownThemeId(undefined)).toBe(false);
  });
});
