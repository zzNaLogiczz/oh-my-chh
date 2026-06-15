// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function buildExtension(): void {
  execFileSync(process.execPath, ["scripts/build-extension.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe"
  });
}

function distFiles(dir = join(process.cwd(), "dist")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? distFiles(fullPath) : [fullPath.replace(`${process.cwd()}/`, "")];
  });
}

describe("extension build output", () => {
  it("bundles the manifest content script as a classic self-contained script", () => {
    buildExtension();

    const contentScript = readFileSync(join(process.cwd(), "dist/content/main.js"), "utf8");

    expect(contentScript).not.toMatch(/^\s*import\s/m);
    expect(contentScript).not.toMatch(/^\s*export\s/m);
    expect(contentScript).not.toContain("../assets/");
  });

  it("keeps Phase A dist assets within current-line performance budgets after a fresh build", () => {
    buildExtension();

    expect(statSync(join(process.cwd(), "dist/themes/liquid-glass/index.css")).size).toBeLessThanOrEqual(1_250_000);
    expect(statSync(join(process.cwd(), "dist/content/main.js")).size).toBeLessThanOrEqual(130_000);
  });

  it("ships only runtime theme assets and omits debug/source artifacts by default", () => {
    buildExtension();

    const files = distFiles();

    expect(files).toEqual(expect.arrayContaining([
      "dist/content/main.js",
      "dist/content/preflight.css",
      "dist/popup/index.html",
      "dist/popup/popup.css",
      "dist/popup/popup.js",
      "dist/themes/liquid-glass/index.css",
      "dist/themes/liquid-glass/preflight.css",
      "dist/themes/flat-clean/index.css",
      "dist/themes/flat-clean/preflight.css"
    ]));
    expect(files.filter((file) => /\.(?:ts|md|map)$/.test(file))).toEqual([]);
    expect(files.filter((file) => file.includes("/adapter/"))).toEqual([]);
    expect(files).not.toContain("dist/themes/liquid-glass/routes.css");
    expect(files).not.toContain("dist/themes/liquid-glass/tokens.css");
    expect(files).not.toContain("dist/themes/liquid-glass/rank-badges.css");
    expect(files).not.toContain("dist/themes/liquid-glass/preview.html");
  });
});
