// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dist = join(process.cwd(), "dist");
const read = (path: string) => readFileSync(join(dist, path), "utf8");
const size = (path: string) => statSync(join(dist, path)).size;

function distFiles(dir = dist): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? distFiles(fullPath) : [fullPath.replace(`${dist}/`, "")];
  });
}

// 整个文件共用一次完整构建；全量并发跑时 CPU 满载，构建需要宽裕的超时
describe("extension build output", { timeout: 60_000 }, () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/build-extension.mjs"], { cwd: process.cwd(), stdio: "pipe" });
  }, 60_000);

  it("bundles the manifest content script as a classic self-contained script", () => {
    const contentScript = read("content/main.js");
    expect(contentScript).not.toMatch(/^\s*import\s/m);
    expect(contentScript).not.toMatch(/^\s*export\s/m);
    expect(contentScript).not.toContain("../assets/");
  });

  it("keeps every bundle within its budget and exceljs inside the import page only", () => {
    // 内容脚本只剩皮肤判断 + Excel 宿主（遮罩、页面解析、抓取）
    expect(size("content/main.js")).toBeLessThanOrEqual(80_000);
    expect(size("popup/popup.js")).toBeLessThanOrEqual(40_000);
    expect(size("excel/app.js")).toBeLessThanOrEqual(200_000);
    expect(size("excel/options.js")).toBeLessThanOrEqual(1_600_000);
    for (const bundle of ["content/main.js", "popup/popup.js", "excel/app.js"]) expect(read(bundle)).not.toMatch(/exceljs/i);
  });

  it("ships no retired theme, island or home-remake artifacts and no sources", () => {
    const files = distFiles();
    expect(files.filter((file) => file.startsWith("themes/"))).toEqual([]);
    expect(existsSync(join(dist, "content/remake-home.js"))).toBe(false);
    expect(files.filter((file) => /\.(?:ts|tsx|md|map)$/.test(file))).toEqual([]);
  });
});
