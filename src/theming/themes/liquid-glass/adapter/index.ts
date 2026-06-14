import type { EnhancementScope } from "../../../../platform/enhancement-scope";
import type { ThemeModule } from "../../../theme-module";
import { DEFAULT_THEME_ID } from "../../../catalog";
import { enhanceLiquidGlassHeader } from "./header";
import { enhanceRankEmblems } from "./rank-emblem";

function normalizedText(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function enhancePortalThemeData(root: ParentNode, scope: EnhancementScope): void {
  root.querySelectorAll<HTMLElement>("#portal_block_672 .swiper-slide").forEach((slide) => {
    const titleLink = slide.querySelector<HTMLAnchorElement>("a[title], a");
    const title = (titleLink?.getAttribute("title") || normalizedText(titleLink)).replace(/\s+/g, " ").trim();
    if (title && slide.getAttribute("data-chh-lg-title") !== title) scope.setAttr(slide, "data-chh-lg-title", title);
  });

  root
    .querySelectorAll<HTMLElement>(".omchh-portal-home .frame.move-span, #portal_block_34, #portal_block_676")
    .forEach((el) => {
      if (el.getAttribute("data-chh-lg-promo") !== "true") scope.setAttr(el, "data-chh-lg-promo", "true");
    });
}

export const liquidGlassTheme: ThemeModule = {
  id: DEFAULT_THEME_ID,
  enhance(ctx, scope) {
    enhanceLiquidGlassHeader(ctx, scope);
    enhanceRankEmblems(ctx.root, scope);
    enhancePortalThemeData(ctx.root, scope);
  }
};
