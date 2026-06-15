// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("popup theme catalog wiring", () => {
  it("builds theme options from the catalog without importing runtime adapters", () => {
    const source = readFileSync(join(process.cwd(), "src/preferences/popup/popup.ts"), "utf8");

    expect(source).toContain("../../theming/catalog");
    expect(source).toContain("../../capabilities/catalog");
    expect(source).toContain("THEME_CATALOG");
    expect(source).not.toContain("../theming/registry");
    expect(source).not.toContain("capabilities/registry");
    expect(source).not.toContain(`theme-runtime${"-registry"}`);
    expect(source).not.toContain("themes/liquid-glass/adapter");
    expect(source).not.toContain("foundation/semantics");
  });
});
