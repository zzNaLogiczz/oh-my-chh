// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRoutesCss = () => readFileSync(join(process.cwd(), "src/theming/themes/liquid-glass/routes.css"), "utf8");

const getRuleStartingAt = (css: string, selector: string) => {
  const selectorIndex = css.indexOf(selector);
  expect(selectorIndex).toBeGreaterThan(-1);

  const blockEnd = css.indexOf("\n}", selectorIndex);
  expect(blockEnd).toBeGreaterThan(selectorIndex);

  return css.slice(selectorIndex, blockEnd);
};

describe("spacecp liquid-glass CSS", () => {
  it("removes the Discuz ct2_a sidebar stripe behind settings and messages pages", () => {
    const css = readRoutesCss();
    const shellRule = getRuleStartingAt(
      css,
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body #ct.omchh-settings,'
    );

    expect(shellRule).toContain('body #ct.omchh-messages');
    expect(shellRule).toMatch(/background:\s*transparent\s*!important;/);
    expect(shellRule).toMatch(/background-image:\s*none\s*!important;/);
  });

  it("keeps usergroup privilege tables as one aligned comparison grid", () => {
    const css = readRoutesCss();

    expect(css).toContain("spacecp usergroup comparison table repair");
    const tableRule = getRuleStartingAt(
      css,
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body #ct.omchh-settings-usergroup .omchh-settings-usergroup-table'
    );
    const cellRule = getRuleStartingAt(
      css,
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body #ct.omchh-settings-usergroup .omchh-settings-usergroup-table th,'
    );

    expect(tableRule).toMatch(/table-layout:\s*fixed\s*!important;/);
    expect(tableRule).toMatch(/width:\s*100%\s*!important;/);
    expect(cellRule).toMatch(/display:\s*table-cell\s*!important;/);
    expect(cellRule).toMatch(/float:\s*none\s*!important;/);
    expect(cellRule).toMatch(/vertical-align:\s*middle\s*!important;/);
  });

  it("preserves the real Discuz usergroup two-table matrix instead of stacking columns", () => {
    const css = readRoutesCss();

    expect(css).toContain("spacecp usergroup real table-pair repair");
    const matrixRule = getRuleStartingAt(
      css,
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body #ct.omchh-settings-usergroup .tdats'
    );
    const matrixTableRule = getRuleStartingAt(
      css,
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body #ct.omchh-settings-usergroup .tdats > .omchh-settings-usergroup-table'
    );
    const matrixScrollRule = getRuleStartingAt(
      css,
      'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body #ct.omchh-settings-usergroup .tdats > .tscr'
    );

    expect(matrixRule).toMatch(/display:\s*grid\s*!important;/);
    expect(matrixRule).toMatch(/grid-template-columns:\s*minmax\(190px,\s*240px\)\s+minmax\(240px,\s*300px\)\s+minmax\(260px,\s*1fr\)/);
    expect(matrixTableRule).toMatch(/float:\s*none\s*!important;/);
    expect(matrixTableRule).toMatch(/width:\s*auto\s*!important;/);
    expect(matrixTableRule).toMatch(/margin:\s*0\s*!important;/);
    expect(matrixScrollRule).toMatch(/float:\s*none\s*!important;/);
    expect(matrixScrollRule).toMatch(/overflow-x:\s*auto\s*!important;/);
    expect(matrixScrollRule).toMatch(/width:\s*auto\s*!important;/);
  });
});
