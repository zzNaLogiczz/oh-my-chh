// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("liquid-glass theme CSS", () => {
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

  it("resets Discuz nav positioning inside the liquid-glass header", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toMatch(/#chh-lg-header #nv_ph[\s\S]*float:\s*none\s*!important;[\s\S]*position:\s*static\s*!important;[\s\S]*width:\s*100%\s*!important;/);
    expect(css).toMatch(/#chh-lg-header #nv[\s\S]*float:\s*none\s*!important;[\s\S]*position:\s*relative\s*!important;[\s\S]*left:\s*auto\s*!important;[\s\S]*right:\s*auto\s*!important;/);
  });


  it("ports the sample forum-home final pass", () => {
    const css = readFileSync(join(process.cwd(), "src/themes/liquid-glass/routes.css"), "utf8");

    expect(css).toContain("Sample parity: final forum index glass grid");
    expect(css).toContain("html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct table.fl_tb > tbody > tr");
    expect(css).toContain("html[data-omchh-enabled=\"1\"][data-omchh-theme=\"liquid-glass\"] body.chh-liquid-glass #ct .bmw.flg .bm_h");
    expect(css).toContain("data-chh-lg-footer-badge");
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

  it("declares every detected route in liquid-glass metadata", () => {
    const theme = JSON.parse(readFileSync(join(process.cwd(), "src/themes/liquid-glass/theme.json"), "utf8"));

    expect(theme.routes).toEqual([
      "portal-home",
      "forum-index",
      "thread-list",
      "thread-detail",
      "article-view",
      "profile",
      "compose",
      "unknown"
    ]);
  });

  it("keeps content preflight empty", () => {
    expect(readFileSync(join(process.cwd(), "src/content/preflight.css"), "utf8").trim()).toBe("");
  });
});
