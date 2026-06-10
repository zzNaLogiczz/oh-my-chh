// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readLiquidGlassRoutesCss = () =>
  readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

const getCssBlock = (css: string, selector: string, occurrence = 0) => {
  let searchFrom = 0;
  let selectorIndex = -1;

  for (let index = 0; index <= occurrence; index += 1) {
    selectorIndex = css.indexOf(selector, searchFrom);
    expect(selectorIndex).toBeGreaterThan(-1);
    searchFrom = selectorIndex + selector.length;
  }

  const blockStart = css.indexOf("{", selectorIndex);
  const blockEnd = css.indexOf("\n}", blockStart);

  expect(blockStart).toBeGreaterThan(-1);
  expect(blockEnd).toBeGreaterThan(blockStart);

  return css.slice(blockStart + 1, blockEnd);
};

const expectSmoothAmbientBackground = (css: string, themeSelector: string, rootOccurrence: number) => {
  const rootBackground = getCssBlock(css, themeSelector, rootOccurrence);
  const ambientBefore = getCssBlock(css, `${themeSelector}::before`, 1);
  const ambientAfter = getCssBlock(css, `${themeSelector}::after`, 1);
  const ambientLayers = `${rootBackground}\n${ambientBefore}\n${ambientAfter}`;

  expect(rootBackground).toMatch(/background:\s*[\s\S]*radial-gradient/);
  expect(rootBackground.match(/radial-gradient/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  expect(ambientBefore).toMatch(/linear-gradient/);
  expect(ambientAfter).toMatch(/radial-gradient/);
  expect(ambientLayers).not.toMatch(/repeating-(?:linear|radial)-gradient/i);
};

describe("liquid-glass theme CSS", () => {
  it("centers rank badge labels in the text lane and uses solid saint-demon gold", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/rank-badges.css"), "utf8");
    const routesCss = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const labelRuleStart = css.indexOf(".omchh-post-author-rank[data-omchh-rank-badge=\"heraldic\"] > .omchh-rank-badge .bname");
    const adminGoldRuleStart = css.indexOf(".omchh-rank-badge.t-envoy .bname");
    const labelRule = css.slice(labelRuleStart, css.indexOf("\n}", labelRuleStart));
    const adminGoldRule = css.slice(adminGoldRuleStart, css.indexOf("\n}", adminGoldRuleStart));

    expect(labelRuleStart).toBeGreaterThan(-1);
    expect(labelRule).toMatch(/display:\s*block\s*!important;/);
    expect(labelRule).toMatch(/flex:\s*1 1 0\s*!important;/);
    expect(labelRule).toMatch(/text-align:\s*center\s*!important;/);
    expect(labelRule).toMatch(/max-width:\s*none\s*!important;/);

    expect(adminGoldRuleStart).toBeGreaterThan(-1);
    expect(routesCss).toMatch(/\.omchh-post-author-rank span\s*\{[\s\S]*color:\s*inherit\s*!important;/);
    expect(adminGoldRule).toMatch(/color:\s*#f6d36a\s*!important;/);
    expect(adminGoldRule).toMatch(/text-shadow:[\s\S]*rgba\(246,211,106,\.38\)[\s\S]*!important/);
    expect(adminGoldRule).not.toMatch(/(?:linear|radial)-gradient|background-clip|-webkit-background-clip|-webkit-text-fill-color:\s*transparent/i);
  });

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

  it("uses smooth ambient background blobs without visible grid lines", () => {
    const css = readLiquidGlassRoutesCss();
    const themeSelector = 'html[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"]';

    expectSmoothAmbientBackground(css, themeSelector, 1);
    expectSmoothAmbientBackground(css, `${themeSelector}.chh-liquid-glass`, 0);
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

  it("allows the shared heraldic user group badge to render inside the header account panel", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/rank-badges.css"), "utf8");

    expect(css).toContain("header account user-group heraldic badge");
    expect(css).toContain("#chh-lg-header #g_upmine.omchh-rank-host[data-omchh-rank-badge=\"heraldic\"]");
    expect(css).toMatch(/#ct\.omchh-thread-detail \.omchh-rank-badge\s*,/);
    expect(css).toMatch(/#chh-lg-header #g_upmine \.omchh-rank-badge\s*\{/);
    expect(css).not.toMatch(/body\.chh-liquid-glass\s+\.omchh-rank-badge(?:[\s.{:#,>])/);
    expect(css).toMatch(/#chh-lg-header #g_upmine > \.omchh-rank-badge\s*\{[\s\S]*width:\s*168px\s*!important;[\s\S]*height:\s*44px\s*!important;/);
  });

  it("resets Discuz nav positioning inside the liquid-glass header", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toMatch(/#chh-lg-header #nv_ph[\s\S]*float:\s*none\s*!important;[\s\S]*position:\s*static\s*!important;[\s\S]*width:\s*100%\s*!important;/);
    expect(css).toMatch(/#chh-lg-header #nv[\s\S]*float:\s*none\s*!important;[\s\S]*position:\s*relative\s*!important;[\s\S]*left:\s*auto\s*!important;[\s\S]*right:\s*auto\s*!important;/);
  });

  it("upgrades the Discuz quick navigation popup for the original forum jump markup", () => {
    const css = readLiquidGlassRoutesCss();
    const quickNav = css.slice(css.indexOf("quick navigation popup v2"));

    expect(quickNav).toContain("quick navigation popup v2: original forum jump markup");
    expect(quickNav).toContain("body #qmenu_menu .nav li a");
    expect(quickNav).toContain("body #qmenu_menu #fjump_menu.btda");
    expect(quickNav).toContain("body #qmenu_menu #flsrchdiv > .mbm");
    expect(quickNav).toContain("body #qmenu_menu .jump_bdl");
    expect(quickNav).toContain("body #qmenu_menu .jump_bdl > li");
    expect(quickNav).toMatch(/#qmenu_menu\s*\.jump_bdl\s*>\s*li\s*\{[\s\S]*display:\s*block\s*!important;[\s\S]*overflow:\s*auto\s*!important;/);
    expect(quickNav).not.toMatch(/#qmenu_menu\s*\.jump_bdl\s*>\s*li\s*\{[\s\S]*flex-direction:\s*column\s*!important;/);
    const forumRows = getCssBlock(quickNav, "body #qmenu_menu .jump_bdl p,");
    expect(forumRows).toMatch(/height:\s*auto\s*!important;/);
    expect(forumRows).toMatch(/max-height:\s*none\s*!important;/);
    expect(forumRows).toMatch(/overflow:\s*visible\s*!important;/);
    expect(quickNav).toMatch(/#qmenu_menu\s*\.jump_bdl\s+p\.xw1\s*\{[\s\S]*position:\s*static\s*!important;[\s\S]*top:\s*auto\s*!important;[\s\S]*z-index:\s*auto\s*!important;/);
    expect(quickNav).not.toMatch(/#qmenu_menu\s*\.jump_bdl\s+p\.xw1\s*\{[\s\S]*position:\s*sticky\s*!important;/);
    const sectionHeading = getCssBlock(quickNav, "body #qmenu_menu .jump_bdl p.xw1 {");
    expect(sectionHeading).toMatch(/height:\s*auto\s*!important;/);
    expect(sectionHeading).toMatch(/max-height:\s*none\s*!important;/);
    expect(sectionHeading).toMatch(/overflow:\s*visible\s*!important;/);
    expect(sectionHeading).toMatch(/padding:\s*0\s*!important;/);
    expect(sectionHeading).toMatch(/border:\s*0\s*!important;/);
    expect(sectionHeading).toMatch(/background:\s*transparent\s*!important;/);
    expect(sectionHeading).toMatch(/box-shadow:\s*none\s*!important;/);
    expect(sectionHeading).toMatch(/backdrop-filter:\s*none\s*!important;/);
    const sectionHeadingLink = getCssBlock(quickNav, "body #qmenu_menu .jump_bdl p.xw1 > a,");
    expect(sectionHeadingLink).toMatch(/min-height:\s*30px\s*!important;/);
    expect(sectionHeadingLink).toMatch(/border:\s*1px solid/);
    expect(sectionHeadingLink).toMatch(/background:[\s\S]*linear-gradient/);
    expect(quickNav).toMatch(/#qmenu_menu\s*\.jump_bdl\s+p\.sub a::before\s*\{[\s\S]*content:\s*"›";/);
    expect(quickNav).toMatch(/#qmenu_menu\s*\.jump_bdl\s+p\.(?:child|a) a/);
    expect(quickNav).toMatch(/#qmenu_menu\s*\.jump_bdl\s*p\.a a\s*\{[\s\S]*background:[\s\S]*var\(--accent\)/);
  });


  it("ports the sample forum-home final pass", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("Sample parity: final forum index glass grid");
    expect(css).toContain("html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct table.fl_tb > tbody > tr");
    expect(css).toContain("html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct .bmw.flg .bm_h");
    expect(css).toContain("data-chh-lg-footer-badge");
  });

  it("maps the Discuz quick rail actions to distinct semantic icons", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const quickRailStart = css.lastIndexOf("quick-rail semantic action icons");
    const quickRail = css.slice(quickRailStart);

    expect(quickRailStart).toBeGreaterThan(css.lastIndexOf("#scrolltop a::before"));
    expect(quickRailStart).toBeGreaterThan(css.lastIndexOf("#scrolltop a::after"));
    expect(quickRail).toContain("quick-rail semantic action icons");
    expect(quickRail).toMatch(/#scrolltop a\.scrolltopa::before\s*\{[\s\S]*rotate\(45deg\)/);
    expect(quickRail).toMatch(/#scrolltop a\.scrolltopa::after\s*\{[\s\S]*height:\s*12px\s*!important;/);
    expect(quickRail).toMatch(/#scrolltop a\.returnboard::before,[\s\S]*#scrolltop a\.returnlist::before\s*\{[\s\S]*border:\s*2px solid currentColor\s*!important;[\s\S]*border-radius:\s*4px\s*!important;/);
    expect(quickRail).toMatch(/#scrolltop a\.returnboard::after,[\s\S]*#scrolltop a\.returnlist::after\s*\{[\s\S]*box-shadow:\s*0 -4px 0 currentColor,\s*0 4px 0 currentColor\s*!important;/);
    expect(quickRail).toMatch(/#scrolltop a\.replyfast::before\s*\{[\s\S]*border-radius:\s*5px\s*!important;/);
    expect(quickRail).toMatch(/#scrolltop a\.replyfast::after\s*\{[\s\S]*clip-path:\s*polygon\(0 0,\s*100% 0,\s*0 100%\)/);
    expect(quickRail).not.toMatch(/content:\s*"返回顶部"/);
    expect(quickRail).not.toMatch(/content:\s*"返回版块"/);
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

  it("styles portal-home top news rows and image titles from screenshot references", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("portal-home screenshot refresh: compact news rows and image-title pills");
    expect(css).toContain("body.chh-liquid-glass #portal_block_673 .acon li a");
    expect(css).toMatch(/#portal_block_673 \.acon li a[\s\S]*display:\s*block\s*!important;/);
    expect(css).toContain("min-height: 32px !important");
    expect(css).toMatch(/#portal_block_673 \.acon li a[\s\S]*width:\s*100%\s*!important;/);
    expect(css).toMatch(/#portal_block_673 \.acon li a[\s\S]*max-width:\s*100%\s*!important;/);
    expect(css).toMatch(/#portal_block_673 \.acon li a[\s\S]*box-sizing:\s*border-box\s*!important;/);
    expect(css).toContain("body.chh-liquid-glass #portal_block_672 .swiper-slide > a");
    expect(css).toContain("body.chh-liquid-glass #portal_block_672 .swiper-slide[data-chh-lg-title]::before");
    expect(css).toContain("backdrop-filter: blur(14px) saturate(1.35)");
  });

  it("keeps forumdisplay thread type pills visible when Discuz collapses the type bar", () => {
    const css = readLiquidGlassRoutesCss();
    const guardStart = css.indexOf("thread-type collapsed row guard");
    expect(guardStart).toBeGreaterThan(-1);

    const guard = css.slice(guardStart);
    expect(guard).toMatch(/\.omchh-thread-types\s*\{[\s\S]*height:\s*auto\s*!important;[\s\S]*min-height:\s*46px\s*!important;[\s\S]*box-sizing:\s*border-box\s*!important;/);
    expect(guard).toMatch(/\.omchh-thread-types:has\(>\s*li\.unfold\)\s*\{[\s\S]*max-height:\s*48px\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(guard).toMatch(/\.omchh-thread-types:has\(>\s*li\.fold\)\s*\{[\s\S]*max-height:\s*none\s*!important;[\s\S]*overflow:\s*visible\s*!important;/);
    expect(guard).toMatch(/\.omchh-thread-types\s*>\s*li\.fold,[\s\S]*\.omchh-thread-types\s*>\s*li\.unfold\s*\{[\s\S]*min-height:\s*30px\s*!important;[\s\S]*flex:\s*0 0 auto\s*!important;/);
  });

  it("aligns portal-home hero band to the page width and keeps the hot card at native banner geometry", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const hero = css.slice(css.indexOf("portal-home hero alignment v8"));

    expect(hero).toContain("portal-home hero alignment v8: page-width parity and native hot-banner geometry");
    expect(hero).toMatch(/\.chip_topmain\s*\{[\s\S]*display:\s*grid\s*!important;/);
    expect(hero).toMatch(/\.chip_topmain\s*\{[\s\S]*width:\s*100%\s*!important;[\s\S]*max-width:\s*var\(--chh-lg-page-width/);
    expect(hero).toMatch(/\.chip_topmain\s*\{[\s\S]*margin:\s*0 auto\s*!important;/);
    expect(hero).toMatch(/\.chip_topmain\s*\{[\s\S]*align-items:\s*start\s*!important;/);
    expect(hero).toMatch(/\.chip_topmain\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*585fr\) minmax\(0,\s*600fr\)/);
    const quickBlock = getCssBlock(hero, ".chip_topmain .cright");
    const hotBlock = getCssBlock(hero, ".chip_topmain .cleft");
    expect(quickBlock).toMatch(/grid-column:\s*1\s*!important;/);
    expect(quickBlock).toMatch(/grid-row:\s*1\s*!important;/);
    expect(hotBlock).toMatch(/grid-column:\s*2\s*!important;/);
    expect(hotBlock).toMatch(/grid-row:\s*1\s*!important;/);
    expect(hero).toMatch(/\.chip_topmain \.chiphell_home\s*\{[\s\S]*flex:\s*0 0 auto\s*!important;[\s\S]*height:\s*auto\s*!important;/);
    expect(hero).toMatch(/#home-banner \.swiper-container\s*\{[\s\S]*flex:\s*0 0 auto\s*!important;[\s\S]*height:\s*252px\s*!important;[\s\S]*max-height:\s*252px\s*!important;/);
    expect(hero).toMatch(/#home-banner \.swiper-wrapper,[\s\S]*#home-banner \.swiper-slide\s*\{[\s\S]*height:\s*252px\s*!important;[\s\S]*max-height:\s*252px\s*!important;/);
    expect(hero).toMatch(/#portal_block_673\s*\{[\s\S]*flex:\s*0 0 auto\s*!important;[\s\S]*height:\s*auto\s*!important;/);
  });

  it("restyles the portal-home hot carousel with the culture-card glass treatment", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const hotRestyle = css.slice(css.indexOf("portal-home hot carousel v9"));

    expect(hotRestyle).toContain("portal-home hot carousel v9: culture-card glass treatment without dimension cloning");
    const hotShell = getCssBlock(hotRestyle, ".chip_topmain .chiphell_home");
    const hotTitle = getCssBlock(hotRestyle, ".chip_topmain .chiphell_home .atit");
    const hotTitlePill = getCssBlock(hotRestyle, ".chip_topmain .chiphell_home .atit span");
    const hotMedia = getCssBlock(hotRestyle, "#home-banner .swiper-container");
    const hotCaption = getCssBlock(hotRestyle, "#portal_block_672 .swiper-slide[data-chh-lg-title]::before");
    const hotPagination = getCssBlock(hotRestyle, "#home-banner .swiper-pagination");
    const hotActiveDot = getCssBlock(hotRestyle, "#home-banner .swiper-pagination-bullet-active");
    const hotArrowGlyph = getCssBlock(hotRestyle, "#home-banner .swiper-button .button-fonts");
    const hotArrowIcon = getCssBlock(hotRestyle, "#home-banner .swiper-button .button-fonts img");

    expect(hotShell).toMatch(/padding:\s*14px\s*!important;/);
    expect(hotShell).toMatch(/border-radius:\s*var\(--chh-lg-radius-xl\)\s*!important;/);
    expect(hotShell).toMatch(/background:\s*[\s\S]*linear-gradient\(135deg,\s*oklch\(100% 0 0 \/ 0\.68\)/);
    expect(hotTitle).toMatch(/margin:\s*0 0 12px\s*!important;/);
    expect(hotTitle).toMatch(/border:\s*0\s*!important;/);
    expect(hotTitle).toMatch(/background:\s*transparent\s*!important;/);
    expect(hotTitlePill).toMatch(/border-radius:\s*999px\s*!important;/);
    expect(hotTitlePill).toMatch(/box-shadow:\s*none\s*!important;/);
    expect(hotMedia).toMatch(/height:\s*252px\s*!important;/);
    expect(hotMedia).toMatch(/border:\s*1px solid color-mix\(in oklch,\s*var\(--chh-lg-border\)/);
    expect(hotMedia).toMatch(/border-radius:\s*var\(--chh-lg-radius-lg\)\s*!important;/);
    expect(hotMedia).toMatch(/box-shadow:\s*[\s\S]*0 12px 28px oklch\(30% 0\.04 250 \/ 0\.1\)/);
    expect(hotCaption).toMatch(/left:\s*18px\s*!important;/);
    expect(hotCaption).toMatch(/bottom:\s*32px\s*!important;/);
    expect(hotCaption).toMatch(/display:\s*inline-flex\s*!important;/);
    expect(hotCaption).toMatch(/backdrop-filter:\s*blur\(14px\) saturate\(1\.35\)/);
    expect(hotPagination).toMatch(/left:\s*18px\s*!important;/);
    expect(hotPagination).toMatch(/bottom:\s*14px\s*!important;/);
    expect(hotActiveDot).toMatch(/width:\s*20px\s*!important;/);
    expect(hotActiveDot).toMatch(/background:\s*[\s\S]*linear-gradient\(90deg,\s*oklch\(72% 0\.16 235 \/ 0\.95\)/);
    expect(hotArrowGlyph).toMatch(/display:\s*flex\s*!important;/);
    expect(hotArrowGlyph).toMatch(/align-items:\s*center\s*!important;/);
    expect(hotArrowGlyph).toMatch(/justify-content:\s*center\s*!important;/);
    expect(hotArrowGlyph).toMatch(/line-height:\s*1\s*!important;/);
    expect(hotArrowIcon).toMatch(/position:\s*static\s*!important;/);
    expect(hotArrowIcon).toMatch(/width:\s*18px\s*!important;/);
    expect(hotArrowIcon).toMatch(/height:\s*18px\s*!important;/);
    expect(hotRestyle).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
  });

  it("styles the portal-home CHH review room as a liquid-glass card grid", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("portal-home review cards: CHH评测室 liquid-glass grid");
    expect(css).toContain("body.chh-liquid-glass .chip_index_cps");
    expect(css).toContain("body.chh-liquid-glass .chip_index_cps .acon ul");
    expect(css).toMatch(/\.chip_index_cps \.acon ul[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.chip_index_cps \.acon ul > section[\s\S]*display:\s*contents\s*!important;/);
    expect(css).toContain("body.chh-liquid-glass .chip_index_cps .acon li .tm01 img");
    expect(css).toContain("body.chh-liquid-glass .chip_index_cps .acon li .avimain .asort");
    expect(css).toContain("-webkit-line-clamp: 3");
  });

  it("refactors portal-home latest articles into the semantic liquid-glass card stream", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("portal-home latest articles v2: semantic Liquid Glass card stream");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-filters a");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-list");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-list > section");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-card");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-thumb img");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-title");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-meta");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-author");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-stats");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-category");
    expect(css).toContain("body.chh-liquid-glass .omchh-portal-latest-summary");
    expect(css).toMatch(/\.omchh-portal-latest-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.omchh-portal-latest-list > section\s*\{[\s\S]*display:\s*contents\s*!important;/);
    expect(css).toContain("portal-home latest articles v3: compact avart metadata alignment");
    expect(css).toMatch(/\.omchh-portal-latest-meta\s*\{[\s\S]*grid-template-columns:\s*34px minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/\.omchh-portal-latest-summary\s*\{[\s\S]*-webkit-line-clamp:\s*3/);
  });

  it("keeps portal-home latest selections and category chips neutral and unclipped", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("portal-home latest articles v4: neutral selection and unclipped category chips");
    expect(css).toMatch(/\.omchh-portal-latest-filters a\.a,[\s\S]*\.omchh-portal-latest-filters a:hover\s*\{[\s\S]*border-color:\s*transparent\s*!important;/);
    expect(css).toMatch(/\.omchh-portal-latest-card\s*\{[\s\S]*border-color:\s*oklch\(100% 0 0 \/ 0\.62\)\s*!important;/);
    expect(css).toMatch(/\.omchh-portal-latest-stats\s*\{[\s\S]*overflow:\s*visible\s*!important;/);
    expect(css).toMatch(/\.omchh-portal-latest-stats \.omchh-portal-latest-category\s*\{[\s\S]*border-color:\s*oklch\(100% 0 0 \/ 0\.4\)\s*!important;[\s\S]*max-width:\s*100%\s*!important;/);
    expect(css).toMatch(/\.omchh-portal-latest-card \.tmpad\s*\{[\s\S]*overflow:\s*visible\s*!important;/);
  });

  it("keeps portal-home card images clipped and review media beds light", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const v5 = css.slice(css.indexOf("portal-home card media v5: restore image clipping and bright media beds"));

    expect(v5).toContain("portal-home card media v5: restore image clipping and bright media beds");
    expect(v5).toMatch(/\.omchh-portal-latest-card\s*\{[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(v5).toMatch(/\.omchh-portal-latest-thumb\s*\{[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(v5).toMatch(/\.chip_index_cps \.acon li \.tm01\s*\{[\s\S]*background:[\s\S]*oklch\(100% 0 0 \/ 0\.72\)/);
    expect(v5).toMatch(/\.chip_index_cps \.acon li \.tm01 img\s*\{[\s\S]*object-position:\s*center center\s*!important;[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.72\)\s*!important;/);
  });

  it("wraps forumdisplay subforums with a collapsible glass shell and centered icon media", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const subforum = css.slice(css.indexOf("forumdisplay subforum v2: wrapped collapsible glass section"));

    expect(subforum).toContain("forumdisplay subforum v2: wrapped collapsible glass section");
    expect(subforum).toMatch(/\.omchh-subforum-section\s*\{[\s\S]*padding:\s*16px\s*!important;[\s\S]*overflow:\s*hidden\s*!important;[\s\S]*border:\s*1px solid/);
    expect(subforum).toMatch(/\.omchh-subforum-section\s*\{[\s\S]*border-radius:\s*var\(--chh-lg-radius-xl\)\s*!important;[\s\S]*backdrop-filter:\s*blur\(26px\) saturate\(1\.65\)/);
    expect(subforum).toMatch(/\.omchh-subforum-collapse\s*\{[\s\S]*display:\s*inline-flex\s*!important;[\s\S]*cursor:\s*pointer\s*!important;/);
    expect(subforum).toMatch(/\.omchh-subforum-collapse em::before\s*\{[\s\S]*content:\s*"收起"/);
    expect(subforum).toMatch(/\.omchh-subforum-collapse em\.tg_yes::before\s*\{[\s\S]*content:\s*"展开"/);
    expect(subforum).toMatch(/\.omchh-subforum-icon a\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*place-items:\s*center\s*!important;/);
    expect(subforum).toMatch(/\.omchh-subforum-icon svg,[\s\S]*\.omchh-subforum-icon img\s*\{[\s\S]*display:\s*block\s*!important;[\s\S]*width:\s*auto\s*!important;[\s\S]*max-width:\s*31px\s*!important;[\s\S]*max-height:\s*29px\s*!important;/);
  });

  it("crops review thumbnails slightly so dark source edges do not read as borders", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const v6 = css.slice(css.indexOf("portal-home review media v6: edge-bleed crop"));

    expect(v6).toContain("portal-home review media v6: edge-bleed crop");
    expect(v6).toMatch(/\.chip_index_cps \.acon li \.tm01 img\s*\{[\s\S]*transform:\s*scale\(1\.035\)\s*!important;/);
    expect(v6).toMatch(/\.chip_index_cps \.acon li:hover \.tm01 img\s*\{[\s\S]*transform:\s*scale\(1\.055\)\s*!important;/);
  });

  it("locks portal media boxes to the original 390x164 crop so thumbnails do not drift", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const v7 = css.slice(css.indexOf("portal-home media v7: stable thumbnail geometry"));

    expect(v7).toContain("portal-home media v7: stable thumbnail geometry");
    expect(v7).toMatch(/\.omchh-portal-latest-thumb\s*\{[\s\S]*aspect-ratio:\s*390 \/ 164\s*!important;[\s\S]*height:\s*164px\s*!important;/);
    expect(v7).toMatch(/\.chip_index_cps \.acon li \.tm01\s*\{[\s\S]*aspect-ratio:\s*390 \/ 164\s*!important;[\s\S]*height:\s*164px\s*!important;/);
    expect(v7).toMatch(/\.omchh-portal-latest-thumb img,[\s\S]*\.chip_index_cps \.acon li \.tm01 img\s*\{[\s\S]*height:\s*100%\s*!important;/);
  });

  it("refactors portal category list content into semantic liquid-glass article stream", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const listLayer = css.slice(css.indexOf("portal-list content area: semantic Liquid Glass article stream"));

    expect(listLayer).toContain("portal-list content area: semantic Liquid Glass article stream");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-route");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-main");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-sidebar");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-shell");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-header");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-subcats a");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-stream");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-card");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-thumb");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-title a");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-summary");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-meta");
    expect(listLayer).toContain("body.chh-liquid-glass .omchh-portal-list-side-card");
    expect(listLayer).toMatch(/\.omchh-portal-list-route\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*280px/);
    expect(listLayer).toMatch(/\.omchh-portal-list-card\s*\{[\s\S]*grid-template-columns:\s*220px minmax\(0,\s*1fr\)/);
    expect(listLayer).toMatch(/\.omchh-portal-list-thumb img\s*\{[\s\S]*max-height:\s*none\s*!important;[\s\S]*min-height:\s*100%\s*!important;/);
    expect(listLayer).toMatch(/\.omchh-portal-list-summary\s*\{[\s\S]*-webkit-line-clamp:\s*3/);
    expect(listLayer).toMatch(/\.omchh-portal-list-side-card \.bm_h \.omchh-portal-list-side-title\s*\{[\s\S]*color:\s*var\(--chh-lg-ink\)\s*!important;/);
    expect(listLayer).toMatch(/\.omchh-portal-list-side-card \.bm_h\s*\{[\s\S]*padding:\s*10px 16px\s*!important;/);
    expect(listLayer).toMatch(/\.omchh-portal-list-side-card \.bm_c\s*\{[\s\S]*padding:\s*6px 12px 10px\s*!important;/);
    expect(listLayer).toMatch(/\.omchh-portal-list-side-card ul\s*\{[\s\S]*gap:\s*6px\s*!important;[\s\S]*row-gap:\s*6px\s*!important;/);
    expect(listLayer).toMatch(/\.omchh-portal-list-side-card li\s*\{[\s\S]*float:\s*none\s*!important;[\s\S]*display:\s*flex\s*!important;[\s\S]*height:\s*auto\s*!important;[\s\S]*font-size:\s*0\s*!important;[\s\S]*line-height:\s*0\s*!important;[\s\S]*overflow:\s*visible\s*!important;/);
    expect(listLayer).toMatch(/\.omchh-portal-list-side-link\s*\{[\s\S]*width:\s*100%\s*!important;[\s\S]*min-height:\s*24px;[\s\S]*line-height:\s*24px\s*!important;/);
    expect(listLayer).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.omchh-portal-list-route\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(css.lastIndexOf("portal-list content area: semantic Liquid Glass article stream")).toBeGreaterThan(css.lastIndexOf("portal-home media v7: stable thumbnail geometry"));
  });

  it("refines portal-list pagination jump input and keeps hover fills neutral", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const listPolish = css.slice(css.indexOf("portal-list controls v2: glass pagination input and neutral hovers"));

    expect(listPolish).toContain("portal-list controls v2: glass pagination input and neutral hovers");
    expect(listPolish).toMatch(/\.omchh-portal-list-main \.omchh-pagination label,[\s\S]*\.omchh-portal-list-main \.pg label\s*\{[\s\S]*display:\s*inline-flex\s*!important;[\s\S]*border-radius:\s*999px\s*!important;[\s\S]*background:[\s\S]*oklch\(100% 0 0 \/ 0\.46\)/);
    expect(listPolish).toMatch(/\.omchh-portal-list-main \.omchh-pagination label \.px,[\s\S]*\.omchh-portal-list-main \.pg label input\[name="custompage"\]\s*\{[\s\S]*width:\s*2\.4em\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/);
    expect(listPolish).toMatch(/\.omchh-portal-list-main \.omchh-pagination label:focus-within,[\s\S]*\.omchh-portal-list-main \.pg label:focus-within\s*\{[\s\S]*border-color:\s*color-mix\(in oklch,\s*var\(--accent\) 44%,\s*oklch\(100% 0 0 \/ 0\.62\)\)/);
    const selectedPageSelector = 'body.chh-liquid-glass .omchh-portal-list-main .omchh-pagination strong,\nhtml[data-omchh-enabled="1"][data-omchh-theme="liquid-glass"] body.chh-liquid-glass .omchh-portal-list-main .pg strong';
    const selectedPageStart = listPolish.indexOf(selectedPageSelector);
    expect(selectedPageStart).toBeGreaterThan(-1);
    const selectedPageRule = listPolish.slice(selectedPageStart, listPolish.indexOf("\n}", selectedPageStart));
    expect(selectedPageRule).toMatch(/background:\s*oklch\(100% 0 0 \/ 0\.5\)\s*!important;/);
    expect(selectedPageRule).not.toMatch(/background:\s*color-mix\(in oklch,\s*var\(--accent\)/);
    expect(listPolish).toMatch(/\.omchh-portal-list-side-link:hover,[\s\S]*\.omchh-portal-list-subcats a:hover,[\s\S]*\.omchh-portal-list-main \.omchh-pagination a:hover\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.5\)\s*!important;/);
    expect(listPolish).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
    expect(listPolish).not.toMatch(/rgb\(\s*(?:169|166|221|239|255)\s*,\s*(?:0|31|55)\s*,\s*(?:0|36|38)\s*\)/i);
  });

  it("styles portal-home culture and topic carousels as liquid-glass paired cards", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("portal-home culture/topic carousel cards: 文化 + 专题 liquid-glass pair");
    expect(css).toContain("body.chh-liquid-glass .chiphell_box:has(> .chip_index_wh):has(> .chip_index_zt)");
    expect(css).toContain("grid-template-columns: minmax(0, 755fr) minmax(320px, 430fr)");
    expect(css).toContain("body.chh-liquid-glass #portal_block_671 > .dxb_bc > .atit span");
    expect(css).toContain("body.chh-liquid-glass #portal_block_674 > .dxb_bc > .atit span");
    expect(css).toContain("body.chh-liquid-glass #newWenhuaSwiper");
    expect(css).toContain("body.chh-liquid-glass #newZTSwiper");
    expect(css).toMatch(/#newZTSwiper \.swiper-slide a p[\s\S]*display:\s*inline-flex\s*!important;/);
    expect(css).toMatch(/#newWenhuaSwiper \.swiper-slide a p[\s\S]*backdrop-filter:\s*blur\(14px\) saturate\(1\.35\)/);
  });

  it("keeps portal-home carousel controls centered and removes legacy red fills", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("portal-home culture/topic optimization: centered arrows, no red fills, text-fit captions");
    expect(css).toMatch(/#newWenhuaSwiper \.swiper-button \.button-fonts[\s\S]*align-items:\s*center\s*!important;[\s\S]*justify-content:\s*center\s*!important;/);
    expect(css).toMatch(/#newWenhuaSwiper \.swiper-button \.button-fonts img[\s\S]*position:\s*static\s*!important;[\s\S]*width:\s*18px\s*!important;[\s\S]*height:\s*18px\s*!important;/);
    expect(css).toContain("body.chh-liquid-glass #newWenhuaSwiper .swiper-pagination-bullet-active");
    expect(css).toMatch(/#newZTSwiper \.swiper-pagination-bullet-active[\s\S]*background:\s*[\s\S]*linear-gradient\(90deg,\s*oklch\(72% 0\.16 235 \/ 0\.95\)/);
    expect(css).toMatch(/#newWenhuaSwiper \.swiper-slide a p[\s\S]*left:\s*18px\s*!important;[\s\S]*width:\s*auto\s*!important;[\s\S]*text-align:\s*left\s*!important;/);
    expect(css).toContain("body.chh-liquid-glass .chip_index_pingce > .atit > span");
  });

  it("keeps portal-home section title pills borderless and captions clear of carousel dots", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const ruleBody = (selectorFragment: string, fromEnd = false) => {
      const index = fromEnd ? css.lastIndexOf(selectorFragment) : css.indexOf(selectorFragment);
      expect(index).toBeGreaterThan(-1);
      const start = css.indexOf("{", index);
      const end = css.indexOf("}", start);
      return css.slice(start + 1, end);
    };

    const cultureTopicTitle = ruleBody("#portal_block_671 > .dxb_bc > .atit span,");
    const reviewTitle = ruleBody(".chip_index_cps > .atit span {");
    const latestTitle = ruleBody(".chip_index_pingce > .atit > span {");

    expect(cultureTopicTitle).toMatch(/border:\s*0\s*!important;/);
    expect(cultureTopicTitle).toMatch(/box-shadow:\s*none\s*!important;/);
    expect(reviewTitle).toMatch(/border:\s*0\s*!important;/);
    expect(reviewTitle).toMatch(/box-shadow:\s*none\s*!important;/);
    expect(latestTitle).toMatch(/border:\s*0\s*!important;/);
    expect(latestTitle).toMatch(/box-shadow:\s*none\s*!important;/);
    expect(ruleBody("#newWenhuaSwiper .swiper-slide a p,", true)).toMatch(/bottom:\s*32px\s*!important;/);
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
    expect(css).toContain("thread-list archive/forumdisplay visual refresh");
    expect(css).toContain(".omchh-forum-heading-layout");
    expect(css).toContain(".omchh-forum-heading-title-row");
    expect(css).toContain(".omchh-forum-heading-meta-row");
    expect(css).toContain(".omchh-subforum-table");
    expect(css).toContain(".omchh-subforum-empty");
    expect(css).toContain(".omchh-thread-notice-row");
    expect(css).toContain(".omchh-thread-list .th");
    expect(css).toContain(".omchh-post");
    expect(css).toContain(".omchh-article");
    expect(css).toContain(".omchh-profile-card");
    expect(css).toContain(".omchh-compose-form");
    expect(css).toContain(".omchh-quick-rail");
  });

  it("redesigns thread detail posts and replies as focused liquid-glass reading cards", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const threadDetail = css.slice(css.indexOf("thread-detail v2: post reading cards and reply composer"));

    expect(threadDetail).toContain("thread-detail v2: post reading cards and reply composer");
    expect(threadDetail).toContain("body.chh-liquid-glass #ct.omchh-thread-detail");
    expect(threadDetail).toContain(".omchh-thread-title-card");
    expect(threadDetail).toContain(".omchh-thread-stat-stack");
    expect(threadDetail).toContain(".omchh-post-shell");
    expect(threadDetail).toContain(".omchh-post[data-omchh-post-role=\"original\"]");
    expect(threadDetail).toContain(".omchh-post[data-omchh-post-role=\"reply\"]");
    expect(threadDetail).toContain(".omchh-post-author-card");
    expect(threadDetail).toContain(".omchh-post-floor");
    expect(threadDetail).toContain(".omchh-post-body");
    expect(threadDetail).toContain(".omchh-post-action-bar");
    expect(threadDetail).toContain(".omchh-thread-reply-textarea");
    expect(threadDetail).toContain(".omchh-thread-reply-submit");
    expect(threadDetail).toMatch(/\.omchh-post-author\s*\{[\s\S]*width:\s*190px\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-post-body\s*\{[\s\S]*font-size:\s*15px\s*!important;[\s\S]*line-height:\s*1\.78\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-reply-textarea\s*\{[\s\S]*min-height:\s*168px\s*!important;/);
    expect(threadDetail).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.omchh-post-author\s*\{[\s\S]*width:\s*100%\s*!important;/);
  });

  it("upgrades thread floor posts with a clear author rail, scrollable medals, and non-red floor marker", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const floorLayer = css.slice(css.indexOf("thread-detail post floors v3: author rail and cool liquid-glass floor marker"));
    const floorStart = floorLayer.indexOf(".omchh-post-floor");
    const floorEnd = floorLayer.indexOf(".omchh-post-floor em", floorStart);
    const floorBlock = floorLayer.slice(floorStart, floorEnd);
    const unclippedLayer = css.slice(css.indexOf("thread-detail post floors v4: prevent author/info and header controls from clipping"));
    const layeredLayer = css.slice(css.indexOf("thread-detail post floors v5: separated author cards and non-overlapping elevator row"));
    const rankStart = layeredLayer.indexOf(".omchh-post-author-rank");
    const rankEnd = layeredLayer.indexOf(".omchh-post-author-rank em", rankStart);
    const rankBlock = layeredLayer.slice(rankStart, rankEnd);

    expect(floorLayer).toContain("thread-detail post floors v3: author rail and cool liquid-glass floor marker");
    expect(unclippedLayer).toContain("thread-detail post floors v4: prevent author/info and header controls from clipping");
    expect(layeredLayer).toContain("thread-detail post floors v5: separated author cards and non-overlapping elevator row");
    expect(unclippedLayer).toMatch(/\.omchh-post > tbody > tr:first-child\s*\{[\s\S]*grid-template-columns:\s*252px minmax\(0,\s*1fr\)\s*!important;/);
    expect(unclippedLayer).toMatch(/\.omchh-post-author\s*\{[\s\S]*width:\s*252px\s*!important;[\s\S]*overflow:\s*visible\s*!important;/);
    expect(floorLayer).toContain(".omchh-post-avatar-shell");
    expect(floorLayer).toContain(".omchh-post-author-rank");
    expect(floorLayer).toContain(".omchh-post-author-tagline");
    expect(floorLayer).toContain(".omchh-post-author-contact");
    expect(unclippedLayer).toMatch(/\.omchh-post-author-name a,[\s\S]*\.omchh-post-author \.xw1\s*\{[\s\S]*white-space:\s*normal\s*!important;[\s\S]*overflow-wrap:\s*anywhere\s*!important;/);
    expect(unclippedLayer).toMatch(/\.omchh-post-author-stats th,[\s\S]*\.omchh-post-author-stats td\s*\{[\s\S]*min-height:\s*50px\s*!important;[\s\S]*overflow:\s*visible\s*!important;/);
    expect(floorLayer).toMatch(/\.omchh-post-medals\s*\{[\s\S]*flex-wrap:\s*wrap\s*!important;[\s\S]*max-height:\s*112px\s*!important;[\s\S]*overflow-y:\s*auto\s*!important;/);
    expect(layeredLayer).toMatch(/\.omchh-post-avatar-shell\s*\{[\s\S]*background:[\s\S]*linear-gradient/);
    expect(layeredLayer).toMatch(/\.omchh-post-author-stats\s*\{[\s\S]*background:[\s\S]*linear-gradient/);
    expect(layeredLayer).toMatch(/\.omchh-post-author-details\s*\{[\s\S]*background:[\s\S]*linear-gradient/);
    expect(rankBlock).toMatch(/justify-content:\s*center\s*!important;/);
    expect(rankBlock).toMatch(/background:[\s\S]*oklch\(100% 0 0 \/ 0\.56\)/);
    expect(rankBlock).not.toMatch(/#(?:a90000|990000|cc0000|dd0000|f00|ff0000)\b/i);
    expect(rankBlock).not.toMatch(/color-mix\(in oklch,\s*var\(--accent\)/);
    expect(unclippedLayer).toMatch(/\.omchh-post-floor-shell,[\s\S]*\.omchh-post-head > strong\s*\{[\s\S]*grid-column:\s*2\s*!important;/);
    expect(unclippedLayer).toMatch(/\.omchh-post-jump\s*\{[\s\S]*grid-column:\s*1 \/ -1\s*!important;[\s\S]*min-width:\s*max-content\s*!important;[\s\S]*overflow:\s*visible\s*!important;/);
    expect(unclippedLayer).toMatch(/\.omchh-post-jump label,[\s\S]*\.omchh-post-jump \.z,[\s\S]*\.omchh-post-jump a\s*\{[\s\S]*float:\s*none\s*!important;[\s\S]*white-space:\s*nowrap\s*!important;/);
    expect(layeredLayer).toMatch(/\.omchh-post-head\s*\{[\s\S]*min-height:\s*94px\s*!important;[\s\S]*margin-bottom:\s*24px\s*!important;[\s\S]*padding-bottom:\s*20px\s*!important;/);
    expect(layeredLayer).toMatch(/\.omchh-post-jump\s*\{[\s\S]*grid-row:\s*2\s*!important;[\s\S]*float:\s*none\s*!important;[\s\S]*clear:\s*both\s*!important;[\s\S]*min-height:\s*38px\s*!important;/);
    expect(layeredLayer).toMatch(/\.omchh-post-content-region,[\s\S]*\.omchh-post-content-card,[\s\S]*\.omchh-post-body-wrap\s*\{[\s\S]*clear:\s*both\s*!important;/);
    expect(floorBlock).toMatch(/background:[\s\S]*oklch\(92% 0\.05 232 \/ 0\.9\)/);
    expect(floorBlock).not.toMatch(/#(?:a90000|990000|cc0000|dd0000|f00|ff0000)\b/i);
    expect(floorBlock).not.toMatch(/oklch\([^)]*\s(?:20|25|29|30|35|40)\s*\/[^)]*\)/i);
  });

  it("defines a tiered rank identity system for user and management groups", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const rankLayer = css.slice(css.indexOf("thread-detail rank identity system: tiered badges, avatar frames, and admin auras"));

    expect(rankLayer).toContain("thread-detail rank identity system: tiered badges, avatar frames, and admin auras");
    for (const rank of [
      "undead",
      "apprentice-angel",
      "angel",
      "archangel",
      "authority-angel",
      "energy-angel",
      "power-angel",
      "dominion-angel",
      "throne-angel",
      "wisdom-angel",
      "seraph",
      "imp",
      "greater-demon",
      "diablo",
      "lucifer",
      "saint-demon-king"
    ]) {
    expect(rankLayer).toContain(`data-omchh-rank="${rank}"`);
    }
    expect(rankLayer).toMatch(/\[data-omchh-rank-family="admin"\]\.omchh-post-author-rank\s*\{[\s\S]*min-height:\s*34px\s*!important;/);
    expect(rankLayer).toMatch(/\.omchh-post-author-card\[data-omchh-rank-effect="3"\]::after\s*\{[\s\S]*animation:\s*omchh-rank-aura-spin/);
    expect(rankLayer).not.toMatch(/\.omchh-post-avatar-shell\[data-omchh-rank-effect="(?:2|3)"\]::(?:before|after)/);
    expect(rankLayer).not.toMatch(/\.omchh-post-avatar-shell\[data-omchh-rank-effect="2"\],[\s\S]*\.omchh-post-avatar-shell\[data-omchh-rank-effect="3"\]\s*\{[\s\S]*0 0 0 4px/);
    expect(rankLayer).not.toContain("--omchh-rank-symbol");
    expect(rankLayer).not.toMatch(/content:\s*var\(--omchh-rank-symbol\)/);
    expect(rankLayer).toMatch(/\.omchh-post-author-rank\[data-omchh-rank\]::before\s*\{[\s\S]*content:\s*\"\"\s*!important;[\s\S]*clip-path:\s*var\(--omchh-rank-mark-clip\)/);
    expect(rankLayer).toMatch(/\[data-omchh-rank-family="admin"\]\.omchh-post-author-rank\s*\{[\s\S]*color:\s*oklch\(28% 0\.07 32\)\s*!important;[\s\S]*background:[\s\S]*oklch\(100% 0 0 \/ 0\.74\)/);
    expect(rankLayer).toMatch(/\.omchh-post-author-rank\[data-omchh-rank-effect="3"\]::after\s*\{[\s\S]*animation:\s*omchh-rank-shimmer 3\.2s/);
    expect(rankLayer).toMatch(/\.omchh-post-author-card\[data-omchh-rank-effect="3"\]::before\s*\{[\s\S]*animation:\s*omchh-rank-pulse/);
    expect(rankLayer).not.toMatch(/\.omchh-post-avatar-shell\[data-omchh-rank-effect="3"\]::before\s*\{[\s\S]*animation:\s*omchh-rank-aura-spin/);
    expect(rankLayer).toMatch(/@keyframes omchh-rank-shimmer/);
    expect(rankLayer).toMatch(/@keyframes omchh-rank-pulse/);
    expect(rankLayer).toMatch(/@keyframes omchh-rank-aura-spin/);
    expect(rankLayer).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*omchh-rank-shimmer/);
    expect(rankLayer).not.toMatch(/[羽翼印晶盾冠座星焰角魔冕王]/);
    expect(rankLayer).not.toMatch(/#(?:a90000|990000|cc0000|dd0000|f00|ff0000)\b/i);
  });

  it("keeps heraldic rank badges uniformly wider and gives saint-demon labels solid gold", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/rank-badges.css"), "utf8");
    const badgeLayer = css.slice(css.indexOf("Heraldic rank badge integration"));
    const shellLayer = badgeLayer.slice(badgeLayer.indexOf("/* ---- badge shell ---- */"));
    const shellBlock = shellLayer.match(/\.omchh-rank-badge\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const medallionBlock = shellLayer.match(/\.omchh-rank-badge \.emblem\s*\{[\s\S]*?\}/)?.[0] ?? "";
    const goldBlock = shellLayer.match(/\.omchh-rank-badge\.t-envoy \.bname,[\s\S]*?\.omchh-rank-badge\.t-king \.bname\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(shellBlock).toMatch(/width:\s*168px/);
    expect(shellBlock).toMatch(/min-width:\s*168px/);
    expect(shellBlock).toMatch(/max-width:\s*168px/);
    expect(shellBlock).toMatch(/height:\s*44px/);
    expect(shellBlock).toMatch(/min-height:\s*44px/);
    expect(shellBlock).toMatch(/padding:\s*3px 14px 3px 7px/);
    expect(medallionBlock).toMatch(/width:\s*38px/);
    expect(medallionBlock).toMatch(/height:\s*38px/);
    expect(goldBlock).toContain(".omchh-rank-badge.t-envoy .bname");
    expect(goldBlock).toContain(".omchh-rank-badge.t-spirit .bname");
    expect(goldBlock).toContain(".omchh-rank-badge.t-king .bname");
    expect(goldBlock).toMatch(/color:\s*#f6d36a\s*!important/);
    expect(goldBlock).not.toMatch(/background:\s*linear-gradient/);
    expect(goldBlock).not.toMatch(/(?:linear|radial)-gradient[^;]*text/i);
    expect(goldBlock).not.toMatch(/background-clip:\s*text/);
    expect(goldBlock).not.toMatch(/-webkit-text-fill-color:\s*transparent/);
    expect(goldBlock).toMatch(/text-shadow:[\s\S]*rgba\(246,211,106,\.38\)[\s\S]*!important/);
  });

  it("skins greater-demon as the elite overlord seal without changing badge dimensions", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/rank-badges.css"), "utf8");
    const badgeLayer = css.slice(css.indexOf("Heraldic rank badge integration"));
    const shellLayer = badgeLayer.slice(badgeLayer.indexOf("/* ---- badge shell ---- */"));
    const shellBlock = shellLayer.match(/\.omchh-rank-badge\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const medallionBlock = shellLayer.match(/\.omchh-rank-badge \.emblem\s*\{[\s\S]*?\}/)?.[0] ?? "";
    const overlordBlock = badgeLayer.slice(badgeLayer.indexOf("大恶魔 \"魔君\""));
    const overlordNameBlock =
      overlordBlock.match(/\.omchh-rank-badge\.elite \.bname,[\s\S]*?\.omchh-rank-badge\.elite \.bname\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(overlordBlock).toContain(".omchh-rank-badge.t-overlord");
    expect(overlordBlock).toContain(".omchh-rank-badge.elite");
    expect(overlordBlock).toContain(".omchh-rank-badge.elite .eseal svg");
    expect(overlordBlock).toContain(".omchh-rank-badge.elite .e-flame");
    expect(overlordBlock).toContain(".omchh-rank-badge.elite .ember");
    expect(overlordBlock).toContain("@keyframes omchh-overlord-glow");
    expect(overlordBlock).toContain("@keyframes omchh-overlord-rise");
    expect(shellBlock).toMatch(/width:\s*168px/);
    expect(shellBlock).toMatch(/height:\s*44px/);
    expect(medallionBlock).toMatch(/width:\s*38px/);
    expect(medallionBlock).toMatch(/height:\s*38px/);
    expect(overlordNameBlock).toMatch(/color:\s*#f6d36a\s*!important/);
    expect(overlordNameBlock).not.toMatch(/background:\s*linear-gradient/);
    expect(overlordNameBlock).not.toMatch(/color:\s*transparent/);
    expect(overlordNameBlock).not.toMatch(/background-clip:\s*text/);
  });

  it("reconstructs the post composer as an editorial liquid-glass workspace", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose new-thread v2: full editorial composer reconstruction");
    expect(compose).toContain("#postform.omchh-compose-form");
    expect(compose).toContain("#ct.omchh-compose .omchh-compose-shell");
    expect(compose).toMatch(/\.omchh-compose-subject-row\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-subject-row::before\s*\{[\s\S]*content:\s*"标题"\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-title-input\s*\{[\s\S]*width:\s*100%\s*!important;[\s\S]*border-radius:\s*16px\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-editor\s*\{[\s\S]*display:\s*block\s*!important;[\s\S]*border-radius:\s*28px\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-toolbar\s*\{[\s\S]*padding:\s*12px\s*!important;[\s\S]*border-bottom:\s*1px solid/);
    expect(compose).toMatch(/\.omchh-compose-tool-group,[\s\S]*\.omchh-compose-toolbar \.b2r/);
    expect(compose).toMatch(/\.omchh-compose-textarea\s*\{[\s\S]*min-height:\s*clamp\(360px,\s*42vh,\s*560px\)\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-statusbar\s*\{[\s\S]*justify-content:\s*flex-end\s*!important;/);
    expect(compose).toContain(".omchh-compose-extra-panel");
    expect(compose).toMatch(/\.omchh-compose-action\[data-omchh-compose-action="primary"\]/);
    expect(compose).toContain("compose toolbar v3: compact native-icon toolbelt and stronger editor boundary");
    expect(compose).toMatch(/\.omchh-compose-toolbar\s*\{[\s\S]*width:\s*calc\(100% - 24px\)\s*!important;[\s\S]*background:[\s\S]*linear-gradient/);
    expect(compose).toMatch(/\.omchh-compose-toolbar \.z,[\s\S]*\.omchh-compose-toolbar p\s*\{[\s\S]*display:\s*contents\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-toolbar a,[\s\S]*\.omchh-compose-toolbar label,[\s\S]*\.omchh-compose-toolbar \.cst\s*\{[\s\S]*background-color:\s*oklch\(100% 0 0 \/ 0\.36\)\s*!important;/);
    expect(compose).toMatch(/#e_bold,[\s\S]*#e_redo\s*\{[\s\S]*text-indent:\s*-999px\s*!important;/);
    expect(compose).toMatch(/\.omchh-compose-textarea\s*\{[\s\S]*0 0 0 4px color-mix\(in oklch,\s*var\(--accent\) 8%,\s*transparent\)\s*!important;/);
    expect(compose).toContain("compose toolbar v4: stable semantic controls, rich/plain panes, fullscreen repair");
    expect(compose).toContain("#e_iframe.omchh-compose-wysiwyg");
    expect(compose).toMatch(/#e_textarea\[style\*="display:\s*none"\]\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(compose).toMatch(/#e_switcher:has\(#e_switchercheck:not\(:checked\)\)::after\s*\{[\s\S]*content:\s*"富文本"\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#e_controls\.omchh-compose-toolbar/);
    expect(compose).toMatch(/#e_bold::before\s*\{[\s\S]*content:\s*"B"\s*!important;/);
    expect(compose).toMatch(/#e_fontname\s*\{[\s\S]*min-width:\s*58px\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(compose).toContain("compose v5: centered popups, safe plain text inset, native-like fullscreen");
    expect(compose).toMatch(/\.omchh-popup-surface\[data-omchh-popup-centered="1"\]\s*\{[\s\S]*max-width:\s*min\(560px,\s*calc\(100vw - 28px\)\)\s*!important;/);
    expect(compose).toMatch(/#e_body\[data-omchh-compose-mode="plain"\][\s\S]*#e_textarea\.omchh-compose-textarea\s*\{[\s\S]*padding:\s*24px 26px\s*!important;[\s\S]*background-clip:\s*padding-box\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#e_controls\.omchh-compose-toolbar\s*\{[\s\S]*border-radius:\s*0\s*!important;[\s\S]*max-height:\s*96px\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#e_controls\.omchh-compose-toolbar #e_button\.omchh-compose-tool-groups\s*\{[\s\S]*float:\s*left\s*!important;[\s\S]*display:\s*block\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#e_controls\.omchh-compose-toolbar a::before\s*\{[\s\S]*content:\s*none\s*!important;[\s\S]*display:\s*none\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#e_controls\.omchh-compose-toolbar #e_bold,[\s\S]*#e_controls\.omchh-compose-toolbar #e_redo\s*\{[\s\S]*font-size:\s*10px\s*!important;[\s\S]*text-indent:\s*0\s*!important;/);
  });

  it("skins Discuz reply popup windows with liquid-glass modal chrome", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose v8: liquid-glass reply popup chrome");
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask\[data-omchh-popup-centered="1"\],[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\]\[data-omchh-popup-centered="1"\]\s*\{[\s\S]*padding:\s*14px\s*!important;[\s\S]*border-radius:\s*30px\s*!important;[\s\S]*backdrop-filter:\s*blur\(24px\) saturate\(1\.22\)\s*!important;/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.m_c,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*\.m_c\s*\{[\s\S]*padding:\s*18px\s*!important;[\s\S]*border-radius:\s*24px\s*!important;[\s\S]*background:[\s\S]*linear-gradient/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.flb,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*\.flb\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*border-bottom:\s*1px solid/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.flbc,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*\.flbc\s*\{[\s\S]*width:\s*30px\s*!important;[\s\S]*border-radius:\s*999px\s*!important;[\s\S]*text-indent:\s*-999px\s*!important;/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.flbc::before,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*\.flbc::before\s*\{[\s\S]*content:\s*"×"\s*!important;/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.tedt,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*\.tedt\s*\{[\s\S]*border-radius:\s*22px\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*textarea,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*textarea\s*\{[\s\S]*min-height:\s*126px\s*!important;[\s\S]*border-radius:\s*20px\s*!important;/);
  });

  it("removes legacy Discuz fwin table frame edges from reply popups", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose v9: remove legacy Discuz popup frame edges");
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.fwin \.t_l,[\s\S]*\.omchh-popup-surface\[id\^="fwin_"\][\s\S]*\.fwin \.b_r\s*\{[\s\S]*display:\s*none\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*border:\s*0\s*!important;/);
    expect(compose).toMatch(/\.omchh-popup-surface\.fwinmask[\s\S]*\.fwin\s*\{[\s\S]*border-collapse:\s*collapse\s*!important;[\s\S]*border-spacing:\s*0\s*!important;[\s\S]*background:\s*transparent\s*!important;/);
  });

  it("releases Discuz fullscreen editor from glass-shell clipping contexts", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose v6: release fullscreen from glass clipping contexts");
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#ct\.omchh-compose \.omchh-compose-shell\s*\{[\s\S]*overflow:\s*visible\s*!important;[\s\S]*backdrop-filter:\s*none\s*!important;[\s\S]*-webkit-backdrop-filter:\s*none\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#ct\.omchh-compose \.omchh-compose-editor\s*\{[\s\S]*overflow:\s*visible\s*!important;[\s\S]*border-radius:\s*0\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#ct\.omchh-compose \.omchh-compose-shell::before\s*\{[\s\S]*display:\s*none\s*!important;/);
  });

  it("applies fullscreen rules immediately from Discuz inline fixed styles", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose v7: immediate native fullscreen before observer sync");
    expect(compose).toMatch(/#ct\.omchh-compose:has\(#e_controls\.omchh-compose-toolbar\[style\*="position:\s*fixed"\]\) \.omchh-compose-shell,[\s\S]*\{[\s\S]*overflow:\s*visible\s*!important;[\s\S]*backdrop-filter:\s*none\s*!important;/);
    expect(compose).toMatch(/#e_controls\.omchh-compose-toolbar\[style\*="position:\s*fixed"\]\s*\{[\s\S]*width:\s*100vw\s*!important;[\s\S]*margin:\s*0\s*!important;[\s\S]*border-radius:\s*0\s*!important;/);
    expect(compose).toMatch(/#e_body \.omchh-compose-textarea-shell\[style\*="position:\s*fixed"\]\s*\{[\s\S]*width:\s*100vw\s*!important;[\s\S]*height:\s*auto\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(compose).toMatch(/#e_bbar\.omchh-compose-statusbar\[style\*="position:\s*fixed"\]\s*\{[\s\S]*width:\s*100vw\s*!important;[\s\S]*border-radius:\s*0\s*!important;/);
  });

  it("hides page chrome and floating rails during compose fullscreen", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose v8: hide page chrome during fullscreen editing");
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\]\s*#chh-lg-header,[\s\S]*body\[data-omchh-compose-fullscreen="1"\]\s*#hd\.omchh-header,[\s\S]*body\[data-omchh-compose-fullscreen="1"\]\s*#scrolltop\.omchh-quick-rail\s*\{[\s\S]*display:\s*none\s*!important;[\s\S]*visibility:\s*hidden\s*!important;/);
    expect(compose).toMatch(/body\.chh-liquid-glass:has\(#ct\.omchh-compose #e_controls\.omchh-compose-toolbar\[style\*="position:\s*fixed"\]\)\s*#chh-lg-header,[\s\S]*body\.chh-liquid-glass:has\(#ct\.omchh-compose #e_controls\.omchh-compose-toolbar\[style\*="position:\s*fixed"\]\)\s*#scrolltop\.omchh-quick-rail\s*\{[\s\S]*display:\s*none\s*!important;[\s\S]*visibility:\s*hidden\s*!important;/);
  });

  it("covers fullscreen editor leftovers with an editor-only matte layer", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));

    expect(compose).toContain("compose v9: editor matte covers fullscreen leftovers");
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#e_body\.omchh-compose-editor::before,[\s\S]*body\.chh-liquid-glass:has\(#ct\.omchh-compose #e_controls\.omchh-compose-toolbar\[style\*="position:\s*fixed"\]\)[\s\S]*#e_body\.omchh-compose-editor::before\s*\{[\s\S]*position:\s*fixed\s*!important;[\s\S]*inset:\s*0\s*!important;[\s\S]*z-index:\s*9997\s*!important;[\s\S]*background:\s*#fff\s*!important;[\s\S]*pointer-events:\s*none\s*!important;/);
    expect(compose).toMatch(/#e_controls\.omchh-compose-toolbar\[style\*="position:\s*fixed"\]\s*\{[\s\S]*z-index:\s*10000\s*!important;/);
    expect(compose).toMatch(/#e_body \.omchh-compose-textarea-shell\[style\*="position:\s*fixed"\]\s*\{[\s\S]*z-index:\s*9998\s*!important;/);
    expect(compose).toMatch(/#e_bbar\.omchh-compose-statusbar\[style\*="position:\s*fixed"\]\s*\{[\s\S]*z-index:\s*9999\s*!important;/);
    expect(compose).toMatch(/body\[data-omchh-compose-fullscreen="1"\][\s\S]*#ct\.omchh-compose \.omchh-compose-tabs,[\s\S]*body\[data-omchh-compose-fullscreen="1"\][\s\S]*#ct\.omchh-compose \.omchh-compose-actions\s*\{[\s\S]*display:\s*none\s*!important;[\s\S]*visibility:\s*hidden\s*!important;/);
  });

  it("leaves Discuz compose editor visibility controls to the original scripts", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const compose = css.slice(css.indexOf("compose new-thread v2: full editorial composer reconstruction"));
    const rulesFor = (selector: string) =>
      Array.from(compose.matchAll(/([^{}]+)\{([^{}]*)\}/g))
        .filter((match) => match[1].includes(selector))
        .map((match) => match[2])
        .join("\n");

    const imageNoticeRules = rulesFor("#e_imagen");
    const toolbarMaskRules = rulesFor("#e_controls_mask");

    expect(imageNoticeRules).not.toMatch(/\bdisplay\s*:/i);
    expect(imageNoticeRules).not.toMatch(/\bbackground(?:-image)?\s*:/i);
    expect(imageNoticeRules).not.toMatch(/\btext-indent\s*:/i);
    expect(toolbarMaskRules).not.toMatch(/\bdisplay\s*:/i);
  });

  it("keeps forumdisplay subforum table overrides after forum-index grid rules", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    const threadListRefresh = css.lastIndexOf("thread-list archive/forumdisplay visual refresh");
    const forumIndexGrid = css.lastIndexOf("table.fl_tb > tbody > tr > td:not(.fl_g)");
    const headingLayout = css.slice(threadListRefresh).match(/\.omchh-forum-heading-layout\s*\{[\s\S]*grid-template-areas:\s*"title actions"\s*"meta meta"/);
    const subforumGrid = css.slice(threadListRefresh).match(/\.omchh-subforum-row\s*\{[\s\S]*grid-template-columns:\s*48px minmax\(0,\s*1fr\) auto/);

    expect(threadListRefresh).toBeGreaterThan(-1);
    expect(headingLayout).toBeTruthy();
    expect(subforumGrid).toBeTruthy();
    expect(forumIndexGrid).toBeGreaterThan(-1);
    expect(threadListRefresh).toBeGreaterThan(forumIndexGrid);
  });

  it("aligns forumdisplay filters and column labels with thread row columns", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const toolbar = css.slice(css.indexOf("thread-list toolbar v2: hidden top pager and aligned filters"));
    const toolbarV3 = css.slice(css.indexOf("thread-list toolbar v3: popover spacing and exact column rails"));

    expect(toolbar).toContain("thread-list toolbar v2: hidden top pager and aligned filters");
    expect(toolbar).toMatch(/\.omchh-thread-top-pagination\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(toolbar).toMatch(/\.omchh-thread-list \.th\s*\{[\s\S]*grid-template-columns:\s*34px minmax\(0,\s*1fr\) minmax\(116px,\s*0\.22fr\) 86px minmax\(128px,\s*0\.24fr\)\s*!important;/);
    expect(toolbar).toMatch(/\.omchh-thread-list \.th \.tf\s*\{[\s\S]*grid-column:\s*1 \/ 3\s*!important;/);
    expect(toolbar).toContain(".omchh-thread-list .th .tf > #atarget");
    expect(toolbar).not.toContain(".omchh-thread-list .th .tf > span");
    expect(toolbar).toMatch(/\.omchh-thread-list \.th \.by,[\s\S]*\.omchh-thread-list \.th \.num\s*\{[\s\S]*justify-self:\s*stretch\s*!important;/);
    expect(toolbar).toMatch(/\.omchh-thread-new-action\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.34\)\s*!important;/);

    expect(toolbarV3).toContain("thread-list toolbar v3: popover spacing and exact column rails");
    expect(toolbarV3).toMatch(/#ct\.omchh-thread-list-route\s*\{[\s\S]*--omchh-thread-list-columns:\s*34px minmax\(0,\s*1fr\) minmax\(128px,\s*0\.22fr\) 96px minmax\(168px,\s*0\.26fr\);/);
    expect(toolbarV3).toMatch(/\.omchh-list-toolbar\s*\{[\s\S]*margin:\s*0 0 14px\s*!important;/);
    expect(toolbarV3).toMatch(/\.omchh-thread-row > tr:not\(\.threadpre\),[\s\S]*\.omchh-thread-list \.th\s*\{[\s\S]*grid-template-columns:\s*var\(--omchh-thread-list-columns\)\s*!important;/);
    expect(toolbarV3).toMatch(/\.omchh-thread-list \.th \.by\s*\{[\s\S]*justify-content:\s*flex-start\s*!important;[\s\S]*text-align:\s*left\s*!important;/);
    expect(toolbarV3).toMatch(/#visitedforums_menu\s*\{[\s\S]*width:\s*240px\s*!important;[\s\S]*max-height:\s*min\(420px,\s*calc\(100vh - 120px\)\)\s*!important;[\s\S]*overflow:\s*auto\s*!important;/);
    expect(toolbarV3).toMatch(/#visitedforums_menu a\s*\{[\s\S]*height:\s*auto\s*!important;[\s\S]*white-space:\s*normal\s*!important;[\s\S]*overflow:\s*visible\s*!important;/);
  });

  it("turns the forumdisplay more filter menu into a grouped glass picker", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const moreMenu = css.slice(css.indexOf("thread-list toolbar v4: grouped more filter popover"));

    expect(moreMenu).toContain("thread-list toolbar v4: grouped more filter popover");
    expect(moreMenu).toMatch(/#filter_dateline_menu\s*\{[\s\S]*width:\s*340px\s*!important;[\s\S]*padding:\s*14px\s*!important;[\s\S]*border-radius:\s*var\(--chh-lg-radius-lg\)\s*!important;/);
    expect(moreMenu).toMatch(/#filter_dateline_menu \.pop_moremenu\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*gap:\s*12px\s*!important;/);
    expect(moreMenu).toMatch(/#filter_dateline_menu \.pop_moremenu > li\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*grid-template-columns:\s*56px repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(moreMenu).toMatch(/#filter_dateline_menu \.pipe\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(moreMenu).toMatch(/#filter_dateline_menu a\s*\{[\s\S]*min-height:\s*32px\s*!important;[\s\S]*border-radius:\s*999px\s*!important;/);
    expect(moreMenu).toMatch(/#filter_dateline_menu a\.xw1\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.56\)\s*!important;/);
  });

  it("wraps pinned forumdisplay threads in a collapsible sticky-topic card layer", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const stickyCard = css.slice(css.indexOf("thread-list sticky card v5: collapsible pinned posts shell"));

    expect(stickyCard).toContain("thread-list sticky card v5: collapsible pinned posts shell");
    expect(stickyCard).toContain(".omchh-thread-sticky-card");
    expect(stickyCard).toContain(".omchh-thread-sticky-card-cell");
    expect(stickyCard).toContain(".omchh-thread-sticky-toggle");
    expect(stickyCard).toContain(".omchh-thread-sticky-card-item");
    expect(stickyCard).toMatch(/\.omchh-thread-sticky-card-cell\s*\{[\s\S]*border-radius:\s*var\(--chh-lg-radius-md\) var\(--chh-lg-radius-md\) 0 0\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-sticky-card-item\s*\{[\s\S]*margin:\s*0\s*!important;[\s\S]*padding:\s*0 8px\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-sticky-card-last > tr\s*\{[\s\S]*border-radius:\s*0 0 var\(--chh-lg-radius-md\) var\(--chh-lg-radius-md\)\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-table\[data-omchh-sticky-card-collapsed="true"\] > \.omchh-thread-sticky-card-item\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-table\[data-omchh-sticky-card-collapsed="true"\] > \.omchh-thread-sticky-card \.omchh-thread-sticky-card-cell\s*\{[\s\S]*border-radius:\s*var\(--chh-lg-radius-md\)\s*!important;/);
    expect(stickyCard).not.toContain("hideStickThread");
  });

  it("hides sticky-thread hide controls and keeps preview hover neutral", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const stickyCard = css.slice(css.indexOf("thread-list sticky card v5: collapsible pinned posts shell"));

    expect(stickyCard).toMatch(/\.omchh-thread-title \.closeprev\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-title \.tdpre\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.30\)\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-title \.tdpre:hover,[\s\S]*\.omchh-thread-title \.tdpre:focus-visible\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.48\)\s*!important;/);
    expect(stickyCard).not.toMatch(/\.omchh-thread-title \.tdpre:hover[\s\S]{0,260}(?:#(?:a90000|990000|dd0000|f00)|red|rgb\(\s*(?:169|166|221|239|255)\s*,\s*(?:0|31|55)\s*,\s*(?:0|36|38)\s*\))/i);
  });

  it("keeps ajax thread previews as compact full-width preview rows", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const stickyCard = css.slice(css.indexOf("thread-list sticky card v5: collapsible pinned posts shell"));

    expect(css).toMatch(/body \.omchh-thread-row > tr:not\(\.threadpre\)\s*\{[\s\S]*display:\s*grid\s*!important;/);
    expect(css).toMatch(/\.omchh-thread-row > tr:not\(\.threadpre\),[\s\S]*\.omchh-thread-list \.th\s*\{[\s\S]*grid-template-columns:\s*var\(--omchh-thread-list-columns\)\s*!important;/);
    expect(css).not.toMatch(/body \.omchh-thread-row tr\s*\{[\s\S]*display:\s*grid\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-row > tr\.threadpre\s*\{[\s\S]*display:\s*block\s*!important;[\s\S]*min-height:\s*0\s*!important;[\s\S]*grid-template-columns:\s*none\s*!important;/);
    expect(stickyCard).toMatch(/\.omchh-thread-row > tr\.threadpre > \.threadpretd\s*\{[\s\S]*display:\s*block\s*!important;[\s\S]*width:\s*100%\s*!important;[\s\S]*padding:\s*12px\s*!important;/);
    expect(stickyCard).toMatch(/\.previewPost \.tindex\s*\{[\s\S]*width:\s*auto\s*!important;[\s\S]*max-width:\s*100%\s*!important;/);
  });

  it("redesigns forumdisplay pagination as a neutral glass control bar with right-aligned actions", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const controls = css.slice(css.indexOf("thread-list pagination and quick-post v6: neutral glass controls"));

    expect(controls).toContain("thread-list pagination and quick-post v6: neutral glass controls");
    expect(controls).toMatch(/\.omchh-thread-bottom-toolbar\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*grid-template-columns:\s*max-content minmax\(0,\s*1fr\) auto auto\s*!important;/);
    expect(controls).toMatch(/\.omchh-list-toolbar\s*\{[\s\S]*grid-template-columns:\s*max-content minmax\(0,\s*1fr\) auto auto\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-back-action,[\s\S]*#visitedforumstmp\s*\{[\s\S]*grid-column:\s*3\s*!important;[\s\S]*justify-self:\s*end\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-new-action,[\s\S]*#newspecialtmp\s*\{[\s\S]*grid-column:\s*4\s*!important;[\s\S]*justify-self:\s*end\s*!important;/);
    expect(controls).toMatch(/#autopbn\s*\{[\s\S]*margin:\s*12px 0 12px\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-bottom-pagination \.pg \.nxt,[\s\S]*\.omchh-thread-bottom-toolbar \.pg \.nxt\s*\{[\s\S]*margin-inline-start:\s*10px\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-bottom-pagination label,[\s\S]*#ct\.omchh-thread-list-route \.pg label\s*\{[\s\S]*border-radius:\s*999px\s*!important;[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.42\)\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-bottom-pagination label input\[name="custompage"\],[\s\S]*#ct\.omchh-thread-list-route \.pg label input\[name="custompage"\]\s*\{[\s\S]*outline:\s*none\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-bottom-pagination label:focus-within,[\s\S]*#ct\.omchh-thread-list-route \.pg label:focus-within\s*\{[\s\S]*border-color:\s*color-mix\(in oklch,\s*var\(--accent\) 44%,\s*oklch\(100% 0 0 \/ 0\.62\)\)\s*!important;/);
    expect(controls).toMatch(/#autopbn\s*\{[\s\S]*border-radius:\s*var\(--chh-lg-radius-lg\)\s*!important;[\s\S]*background:[\s\S]*oklch\(100% 0 0 \/ 0\.34\)/);
    expect(controls).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
    expect(controls).not.toMatch(/rgb\(\s*(?:169|166|221|239|255)\s*,\s*(?:0|31|55)\s*,\s*(?:0|36|38)\s*\)/i);
  });

  it("redesigns forumdisplay quick post as a focused liquid-glass composer", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const controls = css.slice(css.indexOf("thread-list pagination and quick-post v6: neutral glass controls"));

    expect(controls).toMatch(/\.omchh-quick-reply\s*\{[\s\S]*border-radius:\s*var\(--chh-lg-radius-xl\)\s*!important;[\s\S]*background:[\s\S]*radial-gradient\(circle at 100% 0,\s*color-mix\(in oklch,\s*var\(--accent\) 12%,\s*transparent\)/);
    expect(controls).toMatch(/\.omchh-quick-reply > \.bm_h\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.30\)\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply > \.bm_h h2::before\s*\{[\s\S]*background:\s*var\(--accent\)\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply \.pbt\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply #subject\s*\{[\s\S]*width:\s*100%\s*!important;[\s\S]*border-color:\s*oklch\(100% 0 0 \/ 0\.46\)\s*!important;[\s\S]*border-radius:\s*999px\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply \.tedt\s*\{[\s\S]*overflow:\s*hidden\s*!important;[\s\S]*border-radius:\s*var\(--chh-lg-radius-lg\)\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply \.tedt \.bar\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*min-height:\s*40px\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply textarea,[\s\S]*\.omchh-quick-reply #fastpostmessage\s*\{[\s\S]*min-height:\s*132px\s*!important;[\s\S]*border:\s*0\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply \.pnpost\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*justify-content:\s*space-between\s*!important;/);
    expect(controls).toMatch(/\.omchh-quick-reply #fastpostsubmit\s*\{[\s\S]*min-height:\s*36px\s*!important;[\s\S]*border-radius:\s*999px\s*!important;[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.36\)\s*!important;/);
    expect(controls).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
  });

  it("keeps forumdisplay posting actions neutral and removes quick-post helper chrome", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const quickPost = css.slice(css.indexOf("thread-list quick-post v7: editorial liquid-glass composer redesign"));
    const controls = css.slice(css.indexOf("thread-list pagination and quick-post v6: neutral glass controls"));

    expect(quickPost).not.toContain("保留原生 Discuz 提交流程");
    expect(quickPost).not.toMatch(/\.omchh-quick-reply > \.bm_h::after\s*\{/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #fastpostreturn\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #fastpostreturn:has\([^)]*\.alert/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #seccheck_fastpost\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #seccheck_fastpost:has\([^)]*input:not\(\[type="hidden"\]\)/);
    expect(quickPost).not.toMatch(/#seccheck_fastpost:has\(\*\)/);
    expect(quickPost).not.toMatch(/#seccheck_fastpost:not\(:empty\)/);

    expect(controls).toMatch(/\.omchh-thread-new-action,[\s\S]*#newspecialtmp\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.34\)\s*!important;/);
    expect(controls).toMatch(/\.omchh-thread-new-action:hover,[\s\S]*#newspecialtmp:hover,[\s\S]*\.omchh-thread-new-action:focus-visible,[\s\S]*#newspecialtmp:focus-visible\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.34\)\s*!important;[\s\S]*transform:\s*none\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #fastpostsubmit\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.36\)\s*!important;/);
    expect(quickPost).toMatch(/#fastpostsubmit:hover,[\s\S]*#fastpostsubmit:focus-visible\s*\{[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.36\)\s*!important;[\s\S]*transform:\s*none\s*!important;/);
  });

  it("preserves the native quick-post editor toolbar icons", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const quickPost = css.slice(css.indexOf("thread-list quick-post v7: editorial liquid-glass composer redesign"));

    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt \.bar \.fpd\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*flex-wrap:\s*wrap\s*!important;/);
    expect(quickPost).not.toMatch(/\.omchh-quick-reply \.tedt \.bar::before\s*\{/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt \.bar \.fpd a\s*\{[\s\S]*width:\s*30px\s*!important;[\s\S]*height:\s*30px\s*!important;[\s\S]*padding:\s*5px\s*!important;[\s\S]*background-origin:\s*content-box\s*!important;[\s\S]*background-clip:\s*content-box\s*!important;[\s\S]*text-indent:\s*-9999px\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt \.bar \.fpd a:hover,[\s\S]*\.omchh-quick-reply \.tedt \.bar \.fpd a:focus-visible\s*\{[\s\S]*transform:\s*none\s*!important;/);
    expect(quickPost).not.toMatch(/\.omchh-quick-reply \.tedt \.bar \.fpd a\s*\{[^}]*\n\s*background:\s*/);
    expect(quickPost).not.toMatch(/\.omchh-quick-reply \.tedt \.bar \.fpd a:hover,[\s\S]*\.omchh-quick-reply \.tedt \.bar \.fpd a:focus-visible\s*\{[^}]*\n\s*background:\s*/);
  });

  it("keeps thread-detail actions split and the title heading horizontal", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const threadDetail = css.slice(css.indexOf("thread-detail v2: post reading cards and reply composer"));
    const toolbarButtonReset = threadDetail.indexOf(
      ".omchh-thread-reply-action,\nhtml[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct.omchh-thread-detail .pgsbtn"
    );
    const splitOverride = threadDetail.indexOf("thread-detail toolbar split v3: keep back left, compose actions right");

    expect(threadDetail).toMatch(/\.omchh-thread-toolbar,[\s\S]*\.pgs\.mtm\s*\{[\s\S]*justify-content:\s*flex-start\s*!important;/);
    expect(splitOverride).toBeGreaterThan(toolbarButtonReset);
    expect(threadDetail).toMatch(/\.omchh-thread-back-action\s*\{[\s\S]*float:\s*none\s*!important;[\s\S]*margin-right:\s*auto\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-new-action,[\s\S]*\.omchh-thread-reply-action\s*\{[\s\S]*float:\s*none\s*!important;[\s\S]*margin-left:\s*0\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-title-card > tbody\s*\{[\s\S]*display:\s*block\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-title-card > tbody > tr\s*\{[\s\S]*grid-template-columns:\s*minmax\(132px,\s*180px\)\s+minmax\(0,\s*1fr\)\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-title-area\s*\{[\s\S]*min-width:\s*0\s*!important;[\s\S]*writing-mode:\s*horizontal-tb\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-heading,[\s\S]*\.omchh-thread-heading \.ts\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*flex-wrap:\s*wrap\s*!important;/);
    expect(threadDetail).toMatch(/\.omchh-thread-subject\s*\{[\s\S]*display:\s*inline\s*!important;[\s\S]*writing-mode:\s*horizontal-tb\s*!important;[\s\S]*word-break:\s*normal\s*!important;/);
  });

  it("aligns thread-detail view and reply counters without colored badge fills", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const threadDetail = css.slice(css.indexOf("thread-detail v2: post reading cards and reply composer"));
    const statStart = threadDetail.indexOf(".omchh-thread-stat-stack");
    const statEnd = threadDetail.indexOf(".omchh-thread-heading", statStart);
    const statBlock = threadDetail.slice(statStart, statEnd);

    expect(statBlock).toMatch(/\.omchh-thread-stat-stack\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*grid-template-columns:\s*auto minmax\(42px,\s*auto\)\s*!important;[\s\S]*justify-content:\s*center\s*!important;/);
    expect(statBlock).toMatch(/\.omchh-thread-stat-stack \.pipe\s*\{[\s\S]*display:\s*none\s*!important;/);
    expect(statBlock).toMatch(/\.omchh-thread-stat-stack \.xg1\s*\{[\s\S]*justify-self:\s*end\s*!important;[\s\S]*background:\s*transparent\s*!important;/);
    expect(statBlock).toMatch(/\.omchh-thread-stat-stack \.xi1\s*\{[\s\S]*justify-self:\s*start\s*!important;[\s\S]*min-width:\s*42px\s*!important;[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.5\)\s*!important;/);
    expect(statBlock).not.toMatch(/\.omchh-thread-stat-stack \.xi1\s*\{[\s\S]*background:\s*color-mix\(in oklch,\s*var\(--accent\)/);
    expect(statBlock).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
    expect(statBlock).not.toMatch(/rgb\(\s*(?:169|166|221|239|255)\s*,\s*(?:0|31|55)\s*,\s*(?:0|36|38)\s*\)/i);
  });

  it("refreshes thread-detail pagination and quick reply to match the forumdisplay composer", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const detailPolish = css.slice(css.indexOf("thread-detail pagination and quick-reply v4: forumdisplay composer parity"));

    expect(detailPolish).toContain("thread-detail pagination and quick-reply v4: forumdisplay composer parity");
    expect(detailPolish).toMatch(/\.pgbtn\s*\{[\s\S]*display:\s*block\s*!important;[\s\S]*border-radius:\s*var\(--chh-lg-radius-lg\)\s*!important;/);
    expect(detailPolish).toMatch(/\.pgbtn a\s*\{[\s\S]*min-height:\s*42px\s*!important;[\s\S]*background:[\s\S]*oklch\(100% 0 0 \/ 0\.34\)/);
    expect(detailPolish).toMatch(/\.pg label input\[name="custompage"\]\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*transparent\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/);
    expect(detailPolish).toMatch(/\.omchh-quick-reply\s*\{[\s\S]*isolation:\s*isolate\s*!important;[\s\S]*border-radius:\s*28px\s*!important;[\s\S]*radial-gradient\(circle at 14% 0/);
    expect(detailPolish).toMatch(/\.omchh-quick-reply::after\s*\{[\s\S]*width:\s*3px\s*!important;[\s\S]*linear-gradient\(180deg,/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-layout > tbody > tr\s*\{[\s\S]*grid-template-columns:\s*minmax\(86px,\s*104px\)\s+minmax\(0,\s*1fr\)\s*!important;/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-editor-shell\s*\{[\s\S]*border-radius:\s*24px\s*!important;[\s\S]*0 16px 36px oklch\(34% 0\.04 250 \/ 0\.10\)/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-toolbar \.fpd\s*\{[\s\S]*display:\s*flex\s*!important;[\s\S]*flex-wrap:\s*wrap\s*!important;/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-toolbar \.fpd a\s*\{[\s\S]*width:\s*30px\s*!important;[\s\S]*height:\s*30px\s*!important;[\s\S]*background-origin:\s*content-box\s*!important;[\s\S]*text-indent:\s*-9999px\s*!important;/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-textarea\s*\{[\s\S]*min-height:\s*168px\s*!important;[\s\S]*repeating-linear-gradient/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-actions\s*\{[\s\S]*display:\s*grid\s*!important;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto\s*!important;/);
    expect(detailPolish).toMatch(/\.omchh-thread-reply-submit\s*\{[\s\S]*min-height:\s*42px\s*!important;[\s\S]*background:\s*oklch\(100% 0 0 \/ 0\.36\)\s*!important;/);
    expect(detailPolish).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
  });

  it("refreshes forumdisplay quick post into an editorial composer with disabled-state affordances", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");
    const quickPost = css.slice(css.indexOf("thread-list quick-post v7: editorial liquid-glass composer redesign"));

    expect(quickPost).toContain("thread-list quick-post v7: editorial liquid-glass composer redesign");
    expect(quickPost).toMatch(/\.omchh-quick-reply\s*\{[\s\S]*position:\s*relative\s*!important;[\s\S]*isolation:\s*isolate\s*!important;[\s\S]*border-radius:\s*28px\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply::after\s*\{[\s\S]*width:\s*3px\s*!important;[\s\S]*background:\s*linear-gradient\(180deg,/);
    expect(quickPost).not.toContain("保留原生 Discuz 提交流程");
    expect(quickPost).not.toMatch(/\.omchh-quick-reply > \.bm_h::after\s*\{/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.pbt\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.pbt::before\s*\{[\s\S]*content:\s*"标题"/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #subject\s*\{[\s\S]*min-height:\s*42px\s*!important;[\s\S]*border-radius:\s*15px\s*!important;/);
    expect(quickPost).not.toMatch(/\.omchh-quick-reply \.tedt \.bar::before\s*\{/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt \.bar \.fpd\s*\{[\s\S]*flex-wrap:\s*wrap\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply textarea,[\s\S]*\.omchh-quick-reply #fastpostmessage\s*\{[\s\S]*min-height:\s*168px\s*!important;[\s\S]*repeating-linear-gradient/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt \.area \.pt\.hm\s*\{[\s\S]*min-height:\s*142px\s*!important;[\s\S]*border:\s*1px dashed/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt \.area \.pt\.hm::before\s*\{[\s\S]*width:\s*38px\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.pnpost\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto\s*!important;[\s\S]*border-radius:\s*20px\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply #fastpostsubmit\s*\{[\s\S]*min-height:\s*42px\s*!important;[\s\S]*font-weight:\s*820\s*!important;/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.pbt\s*\{[\s\S]*box-shadow:[\s\S]*0 14px 32px oklch\(34% 0\.04 250 \/ 0\.08\)/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.tedt\s*\{[\s\S]*box-shadow:[\s\S]*0 16px 36px oklch\(34% 0\.04 250 \/ 0\.10\)/);
    expect(quickPost).toMatch(/\.omchh-quick-reply \.pnpost\s*\{[\s\S]*box-shadow:[\s\S]*0 14px 30px oklch\(34% 0\.04 250 \/ 0\.08\)/);
    expect(quickPost).toContain("@media (prefers-reduced-motion: reduce)");
    expect(quickPost).not.toMatch(/#(?:a90000|990000|dd0000|f00)\b/i);
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
      "settings",
      "messages",
      "compose",
      "unknown"
    ]);
  });

  it("keeps content preflight limited to the rich-editor bootstrap guard", () => {
    const preflightCss = readFileSync(join(process.cwd(), "src/content/preflight.css"), "utf8").trim();

    expect(preflightCss).toContain("Hide Discuz rich-editor textarea during the iframe bootstrap window");
    expect(preflightCss).toMatch(/@supports selector\(:has\(\*\)\)/);
    expect(preflightCss).toMatch(/#e_body:has\(#e_switchercheck:not\(:checked\)\) #e_textarea\s*\{[\s\S]*visibility:\s*hidden\s*!important;/);
  });
});
