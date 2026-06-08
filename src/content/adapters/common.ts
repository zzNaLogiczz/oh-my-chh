import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import { enhanceLiquidGlassHeader } from "./liquid-glass-header";
import type { ContentAdapter } from "./types";

function markSelector(root: ParentNode, adapter: string, selector: string, className: string, required = false): void {
  const count = markAll(root, selector, className, adapter);
  trackSelector(adapter, selector, count, required);
}

const POPUP_SURFACE_SELECTOR = [
  "#append_parent > .p_pop",
  "#append_parent > .p_pof",
  "#append_parent > .sllt",
  "#append_parent > .fwinmask",
  "#append_parent > [id^='fwin_']",
  "#append_parent > [id$='_menu']",
  "#e_editortoolbar > [id$='_menu']",
  "#e_menus .editortoolbar > [id$='_menu']"
].join(", ");

function visiblePopup(element: HTMLElement): boolean {
  return !element.hidden && element.style.display !== "none";
}

function draggablePopup(element: HTMLElement): boolean {
  return element.style.cursor === "move" || element.classList.contains("fwinmask") || element.id.startsWith("fwin_");
}

function cssPixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function elementDimension(element: HTMLElement, axis: "width" | "height"): number {
  const rect = element.getBoundingClientRect();
  const rectValue = axis === "width" ? rect.width : rect.height;
  const offsetValue = axis === "width" ? element.offsetWidth : element.offsetHeight;
  const inlineValue = cssPixelValue(axis === "width" ? element.style.width : element.style.height);
  return Math.max(Math.ceil(rectValue), Math.ceil(offsetValue), Math.ceil(inlineValue), 1);
}

function centerPopup(element: HTMLElement): void {
  const computed = window.getComputedStyle(element);
  const fixed = computed.position === "fixed" || element.style.position === "fixed";
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 1024;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 768;
  const scrollLeft = fixed ? 0 : window.scrollX || document.documentElement.scrollLeft || document.body?.scrollLeft || 0;
  const scrollTop = fixed ? 0 : window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0;
  const width = elementDimension(element, "width");
  const height = elementDimension(element, "height");
  const left = Math.max(14, Math.round(scrollLeft + (viewportWidth - width) / 2));
  const top = Math.max(14, Math.round(scrollTop + (viewportHeight - height) / 2));

  if (!element.style.position) element.style.position = fixed ? "fixed" : "absolute";
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.dataset.omchhPopupCentered = "1";
}

function syncPopupSurfaces(root: ParentNode, adapter: string): number {
  let count = 0;
  root.querySelectorAll<HTMLElement>(POPUP_SURFACE_SELECTOR).forEach((element) => {
    if (markElement(element, "omchh-popup-surface", adapter)) count += 1;

    if (!visiblePopup(element)) {
      delete element.dataset.omchhPopupCentered;
      return;
    }

    if (!draggablePopup(element) || element.dataset.omchhPopupCentered === "1") return;
    centerPopup(element);
  });
  return count;
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
  trackSelector(adapter, POPUP_SURFACE_SELECTOR, syncPopupSurfaces(root, adapter));
  if (document.body) {
    markElement(document.body, "omchh-body", adapter);
    setData(document.body, "omchhRoute", route);
    setData(document.body, "omchhDensity", settings.density);
  }
  enhanceLiquidGlassHeader({ root, route, settings });
};
