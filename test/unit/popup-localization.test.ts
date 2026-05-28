// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("popup localization", () => {
  it("uses Chinese visible copy for the settings UI", () => {
    const html = readFileSync(join(process.cwd(), "src/popup/index.html"), "utf8");

    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain("Chiphell 美化设置");
    expect(html).toContain("外观");
    expect(html).toContain("行为");
    expect(html).toContain("选择器健康状态");
    expect(html).toContain("隐私");
    expect(html).toContain("Liquid Glass");
    expect(html).not.toContain("Aurora");
    expect(html).not.toContain("空白风格");
    expect(html).not.toContain("Appearance");
    expect(html).not.toContain("Behavior");
    expect(html).not.toContain("Selector health");
    expect(html).not.toContain("Privacy:");
  });
});
