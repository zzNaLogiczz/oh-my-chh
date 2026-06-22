import { markAll, markElement, setData } from "../mark";
import { trackSelector } from "../selector-tracker";
import type { ContentAdapter } from "../context";

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

const POPUP_VIEWPORT_MARGIN = 14;
const DEFAULT_POPUP_MAX_WIDTH = 560;
const DEFAULT_POPUP_MAX_HEIGHT = 620;
const FORUM_WINDOW_MAX_WIDTH = 720;

function forumWindowPopup(element: HTMLElement): boolean {
  return element.classList.contains("fwinmask") || element.id.startsWith("fwin_");
}

function popupMaxWidth(element: HTMLElement, viewportWidth: number): number {
  const available = Math.max(1, viewportWidth - POPUP_VIEWPORT_MARGIN * 2);
  const preferred = forumWindowPopup(element) ? FORUM_WINDOW_MAX_WIDTH : DEFAULT_POPUP_MAX_WIDTH;
  return Math.min(preferred, available);
}

function popupMaxHeight(element: HTMLElement, viewportHeight: number): number {
  const available = Math.max(1, viewportHeight - POPUP_VIEWPORT_MARGIN * 2);
  return forumWindowPopup(element) ? available : Math.min(DEFAULT_POPUP_MAX_HEIGHT, available);
}

function centerPopup(element: HTMLElement): void {
  const computed = window.getComputedStyle(element);
  const fixed = computed.position === "fixed" || element.style.position === "fixed";
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 1024;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 768;
  const scrollLeft = fixed ? 0 : window.scrollX || document.documentElement.scrollLeft || document.body?.scrollLeft || 0;
  const scrollTop = fixed ? 0 : window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0;
  const maxWidth = popupMaxWidth(element, viewportWidth);
  const maxHeight = popupMaxHeight(element, viewportHeight);
  const width = Math.min(elementDimension(element, "width"), maxWidth);
  const height = Math.min(elementDimension(element, "height"), maxHeight);
  const left = Math.max(POPUP_VIEWPORT_MARGIN, Math.round(scrollLeft + (viewportWidth - width) / 2));
  const top = Math.max(POPUP_VIEWPORT_MARGIN, Math.round(scrollTop + (viewportHeight - height) / 2));

  if (!element.style.position) element.style.position = fixed ? "fixed" : "absolute";
  element.style.setProperty("--omchh-popup-max-width", `${maxWidth}px`);
  element.style.setProperty("--omchh-popup-max-height", `${maxHeight}px`);
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.right = "auto";
  element.style.bottom = "auto";
  element.dataset.omchhPopupCentered = "1";
}

export function syncPopupSurfaces(root: ParentNode, adapter = "common"): number {
  let count = 0;
  const rootElement = root instanceof HTMLElement && root.matches(POPUP_SURFACE_SELECTOR) ? [root] : [];
  const descendants = Array.from(root.querySelectorAll<HTMLElement>(POPUP_SURFACE_SELECTOR));
  [...rootElement, ...descendants].forEach((element) => {
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

export function enhancePopupSurfaces(root: ParentNode, adapter = "common"): void {
  trackSelector(adapter, POPUP_SURFACE_SELECTOR, syncPopupSurfaces(root, adapter));
}

export const enhanceCommon: ContentAdapter = (context) => {
  const { root, route, settings } = context;
  const adapter = "common";
  if (context.mode === "incremental") {
    for (const dirtyRoot of context.dirtyRoots ?? []) {
      if (dirtyRoot.kind === "append-popup" || dirtyRoot.kind === "quick-menu") enhancePopupSurfaces(dirtyRoot.element, adapter);
    }
    return;
  }
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
  enhancePopupSurfaces(root, adapter);
  if (document.body) {
    markElement(document.body, "omchh-body", adapter);
    setData(document.body, "omchhRoute", route);
    setData(document.body, "omchhDensity", settings.density);
  }
};
