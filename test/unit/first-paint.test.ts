import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("first paint guard", () => {
  it("injects one document_start content script with the shared preflight guard", () => {
    const manifest = JSON.parse(readProjectFile("manifest.json"));

    expect(manifest.content_scripts).toHaveLength(1);
    const contentScript = manifest.content_scripts[0];
    expect(contentScript.run_at).toBe("document_start");
    expect(contentScript.css).toEqual(["content/preflight.css"]);
    expect(contentScript.js).toEqual(["content/main.js"]);
    // 页面能访问的扩展资源只剩 Excel 皮肤的 iframe 应用
    expect(manifest.web_accessible_resources).toEqual([
      { resources: ["excel/app.html", "excel/app.js", "excel/app.css"], matches: ["https://www.chiphell.com/*"] }
    ]);
  });

  it("hides the Chiphell body until the skin decides what to show", () => {
    const css = readProjectFile("src/platform/preflight.css");

    expect(css).toContain('html:not([data-omchh-paint-ready="1"]) body');
    expect(css).toContain('html[data-omchh-paint-ready="1"] body');
    expect(css).toContain("visibility: hidden !important");
    expect(css).not.toContain("opacity: 0");
  });
});
