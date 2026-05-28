// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("liquid-glass theme CSS", () => {
  it("keeps liquid-glass as the only shipped site theme", () => {
    const themes = readdirSync(join(process.cwd(), "src/themes"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => entry.name)
      .sort();

    expect(themes).toEqual(["liquid-glass"]);
    expect(existsSync(join(process.cwd(), "src/themes/aurora"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/themes/blank"))).toBe(false);
  });

  it("ships all required liquid-glass theme assets", () => {
    const files = [
      "src/themes/liquid-glass/index.css",
      "src/themes/liquid-glass/tokens.css",
      "src/themes/liquid-glass/routes.css",
      "src/themes/liquid-glass/theme.json",
      "src/themes/liquid-glass/preview.html"
    ];

    for (const file of files) {
      expect(existsSync(join(process.cwd(), file))).toBe(true);
    }
  });

  it("scopes route styling to the liquid-glass theme", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const declarations = Array.from(css.matchAll(/\{([^}]*)\}/g), (match) => match[1]).join("\n");

    expect(css).toContain('html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"]');
    expect(declarations).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
    expect(declarations).not.toMatch(/rgb\(\s*(?:169|166|221|239|255)\s*,\s*(?:0|31|55)\s*,\s*(?:0|36|38)\s*\)/i);
  });

  it("styles the liquid-glass header shell and preserved quick menu layer", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("#chh-lg-header");
    expect(css).toContain(".chh-lg-header-glass");
    expect(css).toContain('[data-chh-lg-menu-layer="root"]');
  });

  it("resets Discuz nav positioning inside the liquid-glass header", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toMatch(/#chh-lg-header #nv_ph[\s\S]*float:\s*none\s*!important;[\s\S]*position:\s*static\s*!important;[\s\S]*width:\s*100%\s*!important;/);
    expect(css).toMatch(/#chh-lg-header #nv[\s\S]*float:\s*none\s*!important;[\s\S]*position:\s*relative\s*!important;[\s\S]*left:\s*auto\s*!important;[\s\S]*right:\s*auto\s*!important;/);
  });


  it("ports the sample forum-home final pass", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("Sample parity: final forum index glass grid");
    expect(css).toContain("html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct table.fl_tb > tbody > tr");
    expect(css).toContain("html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct .bmw.flg .bm_h");
    expect(css).toContain("data-chh-lg-footer-badge");
  });

  it("ports the sample portal-home promo band", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("Sample parity: portal-home promo band");
    expect(css).toContain("body.chh-liquid-glass #frame84eS1v");
    expect(css).toContain("body.chh-liquid-glass [data-chh-lg-promo]");
    expect(css).toContain("body.chh-liquid-glass #portal_block_34 .slideshow");
    expect(css).toContain("body.chh-liquid-glass #portal_block_676 .acon li a");
    expect(css).toContain("body.chh-liquid-glass #anc");
    expect(css).toContain("body.chh-liquid-glass #chart > .y a");
  });

  it("keeps the exact Open Design index sample layer last", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("Exact case parity layer from index.html");
    expect(css).toContain('Source: <style id="chiphell-liquid-glass-style">');
    expect(css.lastIndexOf("Exact case parity layer from index.html")).toBeGreaterThan(css.lastIndexOf("Sample parity: final forum index glass grid"));
  });

  it("covers cross-route liquid-glass surfaces", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain(".omchh-thread-list");
    expect(css).toContain(".omchh-post");
    expect(css).toContain(".omchh-article");
    expect(css).toContain(".omchh-profile-card");
    expect(css).toContain(".omchh-compose-form");
    expect(css).toContain(".omchh-quick-rail");
  });

  it("declares every detected route in liquid-glass metadata", () => {
    const theme = JSON.parse(readFileSync(join(process.cwd(), "src/themes/liquid-glass/theme.json"), "utf8"));

    expect(theme.routes).toEqual([
      "portal-home",
      "forum-index",
      "thread-list",
      "thread-detail",
      "article-view",
      "profile",
      "compose",
      "unknown"
    ]);
  });

  it("keeps content preflight empty", () => {
    expect(readFileSync(join(process.cwd(), "src/content/preflight.css"), "utf8").trim()).toBe("");
  });
});
