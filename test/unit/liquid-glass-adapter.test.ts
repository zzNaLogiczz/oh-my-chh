import { afterEach, describe, expect, it } from "vitest";
import { runSharedAdapters } from "../../src/foundation/semantics";
import { EnhancementScope } from "../../src/platform/enhancement-scope";
import { DEFAULT_SETTINGS } from "../../src/preferences/settings";
import { liquidGlassTheme } from "../../src/theming/themes/liquid-glass/adapter";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Liquid Glass adapter rank emblems", () => {
  function scopeCleanupCount(scope: EnhancementScope): number {
    return (scope as unknown as { cleanups: unknown[] }).cleanups.length;
  }

  it("renders heraldic emblems from shared rank identity data", () => {
    document.body.innerHTML = `
      <div id="ct"><div id="postlist"><div id="post_1"><table class="plhin"><tbody><tr>
        <td class="pls"><div id="favatar1" class="pls cl favatar">
          <div class="pi"><div class="authi"><a>楼主</a></div></div>
          <div><div class="avatar"><a class="avtm"><img src="/avatar.jpg" /></a></div></div>
          <p><em>大恶魔</em></p>
        </div></td>
        <td class="plc"><div class="pi"></div><div class="pct"><div class="pcb"><div class="t_fsz"><table><tbody><tr><td class="t_f">正文</td></tr></tbody></table></div></div></div></td>
      </tr></tbody></table></div></div></div>
    `;

    runSharedAdapters("thread-detail", DEFAULT_SETTINGS, document);

    const rank = document.querySelector<HTMLElement>("#favatar1 > p:not(.xg1):not(.md_ctrl)");
    expect(rank?.dataset.omchhRank).toBe("greater-demon");
    expect(rank?.querySelector(".omchh-rank-badge")).toBeNull();

    liquidGlassTheme.enhance({ root: document, route: "thread-detail", settings: DEFAULT_SETTINGS }, new EnhancementScope());

    const badge = rank?.querySelector<HTMLElement>(".omchh-rank-badge");
    expect(rank?.dataset.omchhRankBadge).toBe("heraldic");
    expect(badge?.classList.contains("t-greater")).toBe(true);
    expect(badge?.classList.contains("t-overlord")).toBe(true);
    expect(badge?.classList.contains("elite")).toBe(true);
    expect(badge?.querySelector(".eseal svg")).not.toBeNull();
    expect(badge?.querySelector(".e-flame")).not.toBeNull();
    expect(badge?.querySelectorAll(".ember")).toHaveLength(3);
    expect(badge?.querySelector(".bname")?.textContent).toBe("大恶魔");
  });

  it("restores rank text when the enhancement scope tears down", () => {
    document.body.innerHTML = `<p class="omchh-post-author-rank" data-omchh-rank="angel" data-omchh-rank-family="angel" data-omchh-rank-tier="3" data-omchh-rank-effect="1">天使</p>`;
    const scope = new EnhancementScope();
    const rank = document.querySelector<HTMLElement>("p.omchh-post-author-rank");

    liquidGlassTheme.enhance({ root: document, route: "thread-detail", settings: DEFAULT_SETTINGS }, scope);
    expect(rank?.dataset.omchhRankBadge).toBe("heraldic");
    expect(rank?.querySelector(".omchh-rank-badge")).not.toBeNull();

    scope.teardown();

    expect(rank?.dataset.omchhRankBadge).toBeUndefined();
    expect(rank?.querySelector(".omchh-rank-badge")).toBeNull();
    expect(rank?.textContent).toBe("天使");
  });

  it("adds Liquid Glass portal title and promo data from theme code", () => {
    const scope = new EnhancementScope();
    document.body.innerHTML = `
      <div id="wp" class="omchh-portal-home">
        <div id="portal_block_672"><div class="swiper-slide"><a title="完整标题" href="/article">标题</a></div></div>
        <div class="frame move-span cl"></div>
        <div id="portal_block_34"></div>
        <div id="portal_block_676"></div>
      </div>
    `;

    liquidGlassTheme.enhance({ route: "portal-home", settings: DEFAULT_SETTINGS, root: document }, scope);

    expect(document.querySelector("#portal_block_672 .swiper-slide")?.getAttribute("data-chh-lg-title")).toBe("完整标题");
    expect(document.querySelector(".frame.move-span")?.getAttribute("data-chh-lg-promo")).toBe("true");
    expect(document.querySelector("#portal_block_34")?.getAttribute("data-chh-lg-promo")).toBe("true");
    expect(document.querySelector("#portal_block_676")?.getAttribute("data-chh-lg-promo")).toBe("true");

    scope.teardown();
    expect(document.querySelector("#portal_block_672 .swiper-slide")?.getAttribute("data-chh-lg-title")).toBeNull();
  });

  it("does not register duplicate cleanup work when refreshed repeatedly", () => {
    const scope = new EnhancementScope();
    document.body.innerHTML = `
      <p class="omchh-post-author-rank" data-omchh-rank="angel" data-omchh-rank-family="angel" data-omchh-rank-tier="3" data-omchh-rank-effect="1">天使</p>
      <div id="wp" class="omchh-portal-home">
        <div id="portal_block_672"><div class="swiper-slide"><a title="完整标题" href="/article">标题</a></div></div>
        <div class="frame move-span cl"></div>
        <div id="portal_block_34"></div>
        <div id="portal_block_676"></div>
      </div>
    `;

    liquidGlassTheme.enhance({ route: "portal-home", settings: DEFAULT_SETTINGS, root: document }, scope);
    const cleanupCountAfterFirstPass = scopeCleanupCount(scope);

    liquidGlassTheme.enhance({ route: "portal-home", settings: DEFAULT_SETTINGS, root: document }, scope);

    expect(scopeCleanupCount(scope)).toBe(cleanupCountAfterFirstPass);
  });
});
