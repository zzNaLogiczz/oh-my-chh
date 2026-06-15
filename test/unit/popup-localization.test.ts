// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readPopupHtml(): string {
  return readFileSync(join(process.cwd(), "src/preferences/popup/index.html"), "utf8");
}

function sectionByLabel(html: string, labelId: string): string {
  const start = html.indexOf(`aria-labelledby="${labelId}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = html.indexOf("</section>", start);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe("popup localization", () => {
  it("uses Chinese visible copy for the settings UI", () => {
    const html = readPopupHtml();

    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain("OH-MY-CHH");
    expect(html).toContain("Chiphell 美化设置");
    expect(html).toContain("外观");
    expect(html).toContain("隐私");
    expect(html).toContain("Liquid Glass");
    expect(html).not.toContain("Aurora");
    expect(html).not.toContain("空白风格");
    expect(html).not.toContain("Appearance");
    expect(html).not.toContain("Behavior");
    expect(html).not.toContain("Selector health");
    expect(html).not.toContain("Privacy:");
  });

  it("keeps capability controls catalog-generated and behavior gates out of popup HTML", () => {
    const html = readPopupHtml();
    const appearance = sectionByLabel(html, "appearance-title");

    expect(appearance).toContain("风格");
    expect(appearance).toContain("外观");
    expect(appearance).toContain("选择主题");
    expect(appearance).toContain('id="theme-id"');
    expect(appearance).toContain('name="themeId"');
    expect(appearance).toContain('id="capability-list"');
    expect(appearance).toContain('aria-label="主题信号开关"');

    expect(html).not.toContain("页面增强");
    expect(html).not.toContain("行为");
    expect(html).not.toContain("快速回复增强");
    expect(html).not.toContain("隐藏 UBB 表情");
    expect(html).not.toContain('name="enhanceQuickReply"');
    expect(html).not.toContain('name="hideUbbEmoji"');
  });

  it("removes selector health status from the popup UI", () => {
    const html = readPopupHtml();

    expect(html).not.toContain("选择器健康状态");
    expect(html).not.toContain("最近一次检测");
    expect(html).not.toContain("health-card");
    expect(html).not.toContain("health-route");
    expect(html).not.toContain("health-hit");
    expect(html).not.toContain("health-missing");
  });
});
