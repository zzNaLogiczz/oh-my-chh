import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhancePortalHome: ContentAdapter = ({ root }) => {
  const adapter = "portal-home";
  for (const selector of ["#diy_banner", "#diy_xw", "#diy_cps", "#diy_wh", "#diy_zt"]) {
    const count = markAll(root, selector, "omchh-portal-section", adapter);
    markAll(root, selector, "omchh-module", adapter);
    trackSelector(adapter, selector, count);
    root.querySelectorAll(selector).forEach((element) => setData(element, "omchhPortalSection", selector.slice(1)));
  }
  trackSelector(adapter, ".block, .chiphell_box, .portal_block_summary", markAll(root, ".block, .chiphell_box, .portal_block_summary", "omchh-portal-card", adapter));
  trackSelector(adapter, "[class*=swiper], .slidebox, .slideshow", markAll(root, "[class*=swiper], .slidebox, .slideshow", "omchh-portal-carousel", adapter));
  markElement(document.querySelector("#wp"), "omchh-portal-home", adapter);
  setData(document.querySelector("#frame84eS1v"), "chhLgPromo", "");
};
