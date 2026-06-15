// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readThemeCss(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function expectDarkOverrideAfterLightRouteRule(css: string, darkSelectorSuffix: string, lightSelector: string): void {
  const darkSelector = `html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"][data-omchh-scheme="dark"] ${darkSelectorSuffix}`;
  expect(css.lastIndexOf(darkSelector)).toBeGreaterThan(css.lastIndexOf(lightSelector));
}

describe("theme color-scheme CSS", () => {
  it("keeps Liquid Glass dark rendering behind the root scheme signal", () => {
    const routes = readThemeCss("src/theming/themes/liquid-glass/routes.css");
    const preflight = readThemeCss("src/theming/themes/liquid-glass/preflight.css");

    expect(routes).not.toContain("@media (prefers-color-scheme: dark)");
    expect(routes).not.toContain("color-scheme: light dark");
    expect(routes).toContain('[data-omchh-scheme="dark"]');
    expect(routes).toMatch(/html\[data-omchh-enabled="1"\]\[data-omchh-theme="liquid-glass"\]\[data-omchh-scheme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/);
    expect(routes).toMatch(/html\[data-omchh-enabled="1"\]\[data-omchh-theme="liquid-glass"\]\[data-omchh-scheme="dark"\]\.chh-liquid-glass\s*\{[^}]*color-scheme:\s*dark;/);
    expect(preflight).toContain('[data-omchh-scheme="dark"]');
  });

  it("keeps late Liquid Glass route surfaces readable in dark mode", () => {
    const routes = readThemeCss("src/theming/themes/liquid-glass/routes.css");

    expectDarkOverrideAfterLightRouteRule(
      routes,
      "body.chh-liquid-glass #ct .bmw.flg .bm_h",
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body.chh-liquid-glass #ct .bmw.flg .bm_h {'
    );
    expectDarkOverrideAfterLightRouteRule(
      routes,
      "body.chh-liquid-glass #ct .bmw.flg table.fl_tb > tbody > tr > td.fl_g",
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body.chh-liquid-glass #ct .bmw.flg table.fl_tb > tbody > tr > td.fl_g {'
    );
    expectDarkOverrideAfterLightRouteRule(
      routes,
      "body.chh-liquid-glass #ct.omchh-thread-detail .omchh-post-list",
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body.chh-liquid-glass #ct.omchh-thread-detail .omchh-post-list {'
    );
    expectDarkOverrideAfterLightRouteRule(
      routes,
      "body.chh-liquid-glass #ct.omchh-thread-detail .omchh-post",
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body.chh-liquid-glass #ct.omchh-thread-detail .omchh-post {'
    );
    expect(routes).toContain("--chh-lg-dark-surface:");
    expect(routes).toContain("--chh-lg-dark-surface-strong:");
  });

  it("keeps Flat Clean dark rendering behind the root scheme signal", () => {
    const flatClean = readThemeCss("src/theming/themes/flat-clean/index.css");

    expect(flatClean).toContain('[data-omchh-scheme="dark"]');
    expect(flatClean).toContain("color-scheme: dark");
  });
});
