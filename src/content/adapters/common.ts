import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import { enhanceLiquidGlassHeader } from "./liquid-glass-header";
import type { ContentAdapter } from "./types";

function markSelector(root: ParentNode, adapter: string, selector: string, className: string, required = false): void {
  const count = markAll(root, selector, className, adapter);
  trackSelector(adapter, selector, count, required);
}

export const enhanceCommon: ContentAdapter = ({ root, route, settings }) => {
  const adapter = "common";
  markSelector(root, adapter, "#toptb", "omchh-topbar");
  markSelector(root, adapter, "#hd", "omchh-header");
  markSelector(root, adapter, "#hd", "omchh-site-chrome");
  markSelector(root, adapter, "#nv", "omchh-nav");
  markSelector(root, adapter, "#scbar", "omchh-search");
  markSelector(root, adapter, "#pt.bm.cl, #pt", "omchh-breadcrumb");
  markSelector(root, adapter, "#ft", "omchh-footer");
  markSelector(root, adapter, "#scrolltop", "omchh-quick-rail");
  markSelector(root, adapter, "#wp", "omchh-page", true);
  markSelector(root, adapter, "#ct", "omchh-content");
  markSelector(root, adapter, ".pg, .pgs", "omchh-pagination");
  markSelector(root, adapter, ".bm", "omchh-block");
  markSelector(root, adapter, ".bm", "omchh-module");
  if (document.body) {
    markElement(document.body, "omchh-body", adapter);
    setData(document.body, "omchhRoute", route);
    setData(document.body, "omchhDensity", settings.density);
  }
  enhanceLiquidGlassHeader({ root, route, settings });
};
