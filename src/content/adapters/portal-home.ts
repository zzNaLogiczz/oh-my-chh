import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

function directChildWithClass(parent: Element | null, className: string): HTMLElement | null {
  if (!parent) return null;
  return (
    Array.from(parent.children).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(className)
    ) ?? null
  );
}

function directChildMatching(parent: Element | null, selector: string): HTMLElement | null {
  if (!parent) return null;
  return Array.from(parent.children).find((child): child is HTMLElement => child instanceof HTMLElement && child.matches(selector)) ?? null;
}

function normalizedText(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function enhancePortalCategoryList(root: ParentNode, adapter: string): void {
  const content = root.querySelector<HTMLElement>("#ct.ct2, #ct");
  const main = directChildWithClass(content, "mn");
  const sidebar = directChildWithClass(content, "sd");
  const shell =
    Array.from(main?.children ?? []).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("bm") && !!child.querySelector(".bm_c.xld")
    ) ?? null;
  const stream = directChildMatching(shell, ".bm_c.xld");
  const articleCards = stream ? Array.from(stream.querySelectorAll<HTMLElement>(":scope > dl")) : [];
  const isPortalList = document.body?.classList.contains("pg_list") || articleCards.length > 0;

  if (!content || !main || !shell || !stream || !isPortalList) return;

  markElement(content, "omchh-portal-list-route", adapter);
  markElement(main, "omchh-portal-list-main", adapter);
  markElement(shell, "omchh-portal-list-shell", adapter);
  markElement(stream, "omchh-portal-list-stream", adapter);

  const header = directChildMatching(shell, ".bm_h");
  const subcats = directChildMatching(shell, ".bm_c.bbda");
  markElement(header, "omchh-portal-list-header", adapter);
  markElement(header?.querySelector("h1") ?? null, "omchh-portal-list-heading", adapter);
  markElement(header?.querySelector(".rss") ?? null, "omchh-portal-list-rss", adapter);
  markElement(subcats, "omchh-portal-list-subcats", adapter);
  subcats?.querySelectorAll("a").forEach((link) => markElement(link, "omchh-portal-list-subcat", adapter));
  subcats?.querySelectorAll(".pipe").forEach((pipe) => markElement(pipe, "omchh-portal-list-subcat-divider", adapter));

  articleCards.forEach((card, index) => {
    const title = card.querySelector<HTMLElement>("dt");
    const titleLink = title?.querySelector("a") ?? null;
    const descriptions = Array.from(card.querySelectorAll<HTMLElement>("dd"));
    const summary =
      descriptions.find((description) => description.classList.contains("xs2") || !!description.querySelector(".atc")) ??
      descriptions[0] ??
      null;
    const meta =
      descriptions.find((description) => description !== summary && (!!description.querySelector("label") || !!description.querySelector(".xg1"))) ??
      descriptions.at(-1) ??
      null;
    const category = meta?.querySelector("label") ?? null;
    const date = meta?.querySelector(".xg1") ?? null;
    const thumb = summary?.querySelector(".atc") ?? null;
    const categoryText = normalizedText(category);
    const titleText = normalizedText(titleLink ?? title);

    markElement(card, "omchh-portal-list-card", adapter);
    markElement(title, "omchh-portal-list-title", adapter);
    markElement(summary, "omchh-portal-list-summary", adapter);
    markElement(meta, "omchh-portal-list-meta", adapter);
    markElement(thumb, "omchh-portal-list-thumb", adapter);
    markElement(category, "omchh-portal-list-category", adapter);
    markElement(date, "omchh-portal-list-date", adapter);
    setData(card, "omchhPortalListIndex", String(index));
    if (categoryText) setData(card, "omchhPortalListCategory", categoryText);
    if (titleText) setData(card, "omchhPortalListTitle", titleText);
  });

  markElement(sidebar, "omchh-portal-list-sidebar", adapter);
  sidebar?.querySelectorAll<HTMLElement>(".bm").forEach((card, index) => {
    markElement(card, "omchh-portal-list-side-card", adapter);
    setData(card, "omchhPortalSideIndex", String(index));
  });
  sidebar?.querySelectorAll("h2").forEach((title) => markElement(title, "omchh-portal-list-side-title", adapter));
  sidebar?.querySelectorAll(".bm_c a").forEach((link) => markElement(link, "omchh-portal-list-side-link", adapter));

  trackSelector(adapter, "#ct.ct2 .mn > .bm > .bm_c.xld > dl", articleCards.length);
  trackSelector(adapter, "#ct.ct2 .sd .bm", sidebar?.querySelectorAll(".bm").length ?? 0);
}

export const enhancePortalHome: ContentAdapter = ({ root }) => {
  const adapter = "portal-home";

  // flex 容器里的换行文本节点会变成匿名 flex item（order:0），排在 cright/cleft 之前造成偏移
  root.querySelectorAll(".chip_topmain").forEach((el) => {
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .forEach((n) => n.parentNode?.removeChild(n));
  });
  for (const selector of ["#diy_banner", "#diy_xw", "#diy_cps", "#diy_wh", "#diy_zt"]) {
    const count = markAll(root, selector, "omchh-portal-section", adapter);
    markAll(root, selector, "omchh-module", adapter);
    trackSelector(adapter, selector, count);
    root.querySelectorAll(selector).forEach((element) => setData(element, "omchhPortalSection", selector.slice(1)));
  }
  trackSelector(adapter, ".block, .chiphell_box, .portal_block_summary", markAll(root, ".block, .chiphell_box, .portal_block_summary", "omchh-portal-card", adapter));
  trackSelector(adapter, "[class*=swiper], .slidebox, .slideshow", markAll(root, "[class*=swiper], .slidebox, .slideshow", "omchh-portal-carousel", adapter));
  trackSelector(adapter, ".chip_index_pingce", markAll(root, ".chip_index_pingce", "omchh-portal-latest", adapter));
  trackSelector(adapter, ".chip_index_pingce > .atit", markAll(root, ".chip_index_pingce > .atit", "omchh-portal-latest-header", adapter));
  trackSelector(adapter, ".chip_index_pingce > .atit .fra", markAll(root, ".chip_index_pingce > .atit .fra", "omchh-portal-latest-filters", adapter));
  trackSelector(adapter, ".chip_index_pingce .acon", markAll(root, ".chip_index_pingce .acon", "omchh-portal-latest-content", adapter));
  trackSelector(adapter, ".chip_index_pingce #threadulid, .chip_index_pingce .acon > ul", markAll(root, ".chip_index_pingce #threadulid, .chip_index_pingce .acon > ul", "omchh-portal-latest-list", adapter));
  trackSelector(adapter, ".chip_index_pingce .acon li", markAll(root, ".chip_index_pingce .acon li", "omchh-portal-latest-card", adapter));
  trackSelector(adapter, ".chip_index_pingce .tm01", markAll(root, ".chip_index_pingce .tm01", "omchh-portal-latest-thumb", adapter));
  trackSelector(adapter, ".chip_index_pingce .tm03", markAll(root, ".chip_index_pingce .tm03", "omchh-portal-latest-title", adapter));
  trackSelector(adapter, ".chip_index_pingce .avart", markAll(root, ".chip_index_pingce .avart", "omchh-portal-latest-meta", adapter));
  trackSelector(adapter, ".chip_index_pingce .avimain", markAll(root, ".chip_index_pingce .avimain", "omchh-portal-latest-author", adapter));
  trackSelector(adapter, ".chip_index_pingce .avimain2", markAll(root, ".chip_index_pingce .avimain2", "omchh-portal-latest-stats", adapter));
  trackSelector(adapter, ".chip_index_pingce .tm04", markAll(root, ".chip_index_pingce .tm04", "omchh-portal-latest-summary", adapter));
  trackSelector(adapter, ".chip_index_pingce .asort", markAll(root, ".chip_index_pingce .asort", "omchh-portal-latest-category", adapter));
  root.querySelectorAll<HTMLElement>(".chip_index_pingce .acon li").forEach((item, index) => {
    setData(item, "omchhPortalArticleIndex", String(index));
    const category = item.querySelector(".asort")?.textContent?.replace(/\s+/g, " ").trim();
    if (category) setData(item, "omchhPortalArticleCategory", category);
  });
  root.querySelectorAll<HTMLElement>("#portal_block_672 .swiper-slide").forEach((slide) => {
    const titleLink = slide.querySelector<HTMLAnchorElement>("a[title], a");
    const title = (titleLink?.getAttribute("title") || titleLink?.textContent || "").replace(/\s+/g, " ").trim();
    if (title) setData(slide, "chhLgTitle", title);
  });
  markElement(document.querySelector("#wp"), "omchh-portal-home", adapter);
  setData(document.querySelector("#frame84eS1v"), "chhLgPromo", "");
  enhancePortalCategoryList(root, adapter);
};
