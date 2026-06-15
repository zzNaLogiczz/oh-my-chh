import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getTheme, registerTheme, type ThemeModule } from "../../src/theming/registry";

describe("theme runtime registry", () => {
  it("registers the bundled Liquid Glass runtime module", () => {
    expect(DEFAULT_THEME_ID).toBe("liquid-glass");
    expect(getTheme("liquid-glass")).toBeDefined();
  });

  it("registers the bundled Flat Clean runtime module", () => {
    expect(getTheme("flat-clean")).toBeDefined();
  });

  it("rejects theme modules without catalog metadata", () => {
    const missingTheme: ThemeModule = {
      id: "missing-theme",
      enhance: () => undefined
    };

    expect(() => registerTheme(missingTheme)).toThrow("Theme module has no catalog metadata: missing-theme");
  });
});
