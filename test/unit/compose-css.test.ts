import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/theming/themes/liquid-glass/routes.css"), "utf8");
const preflightCss = readFileSync(join(process.cwd(), "src/theming/themes/liquid-glass/preflight.css"), "utf8");

describe("liquid glass compose CSS contracts", () => {
  it("preflights the rich editor bootstrap textarea before the theme stylesheet finishes loading", () => {
    expect(preflightCss).toMatch(/#e_body:has\(#e_switchercheck:not\(:checked\)\) #e_textarea\s*\{[\s\S]*visibility:\s*hidden\s*!important;/);
  });

  it("keeps Discuz reply/edit title-row content grouped instead of flattening it into the outer grid", () => {
    expect(css).toContain("compose v11: stable default editor and title row repair");
    expect(css).toMatch(/\.omchh-compose-subject-row\s*>\s*\.z[\s\S]*?display:\s*grid\s*!important/);
    expect(css).toMatch(/\.omchh-compose-subject-row\s*>\s*\.z[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s*!important/);
    expect(css).toMatch(/\.omchh-compose-subject-row\s*>\s*\.y[\s\S]*?grid-column:\s*3\s*!important/);
  });

  it("forces the normal non-fullscreen compose editor to a rectangular text surface by default", () => {
    expect(css).toMatch(/body\.chh-liquid-glass:not\(\[data-omchh-compose-fullscreen="1"\]\)[\s\S]*?#ct\.omchh-compose[\s\S]*?\.omchh-compose-textarea-shell[\s\S]*?grid-template:\s*"editor"\s+minmax\(clamp\(360px,\s*42vh,\s*560px\),\s*auto\)/);
    expect(css).toMatch(/#e_textarea\.omchh-compose-textarea[\s\S]*?#e_iframe\.omchh-compose-wysiwyg[\s\S]*?border-radius:\s*20px\s*!important/);
    expect(css).toMatch(/#e_textarea\.omchh-compose-textarea[\s\S]*?#e_iframe\.omchh-compose-wysiwyg[\s\S]*?clip-path:\s*none\s*!important/);
  });
});
