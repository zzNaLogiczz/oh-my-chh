// @vitest-environment node
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("Phase A performance budgets", () => {
  it("keeps Liquid Glass source CSS within the current-line budget", () => {
    const routesPath = "src/theming/themes/liquid-glass/routes.css";
    const routesCss = read(routesPath);

    expect(statSync(join(root, routesPath)).size).toBeLessThanOrEqual(1_150_000);
    expect(count(routesCss, ":has(")).toBeLessThanOrEqual(89);
    expect(count(routesCss, "backdrop-filter")).toBeLessThanOrEqual(250);
  });

  it("requires explicit reduced-glass and reduced-motion root selectors", () => {
    const routesCss = read("src/theming/themes/liquid-glass/routes.css");
    const rankCss = read("src/theming/themes/liquid-glass/rank-badges.css");

    expect(routesCss).toContain('data-omchh-reduce-glass="1"');
    expect(routesCss).toContain('data-omchh-motion="reduce"');
    expect(rankCss).toContain("prefers-reduced-motion");
    expect(rankCss).toContain('data-omchh-motion="reduce"');
  });
});
