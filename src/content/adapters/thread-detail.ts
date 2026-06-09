import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import { enhanceRankBadge, getRankBadgeIdentity, type RankBadgeIdentity } from "./rank-badges";
import type { ContentAdapter } from "./types";

function applyRankIdentity(identity: RankBadgeIdentity | null, elements: Array<Element | null>): void {
  if (!identity) return;
  elements.forEach((element) => {
    setData(element, "omchhRank", identity.rank);
    setData(element, "omchhRankFamily", identity.family);
    setData(element, "omchhRankTier", identity.tier);
    setData(element, "omchhRankEffect", identity.effect);
  });
}

function directChildrenMatching(element: Element | null, selector: string): Element[] {
  if (!element) return [];
  return Array.from(element.children).filter((child) => child.matches(selector));
}

function firstDirectChild(element: Element | null, selector: string): Element | null {
  return directChildrenMatching(element, selector)[0] ?? null;
}

function firstDescendant(element: Element | null, selector: string): Element | null {
  return element?.querySelector(selector) ?? null;
}

function markAllInside(root: ParentNode | null, selector: string, className: string, adapter: string): number {
  return root ? markAll(root, selector, className, adapter) : 0;
}

function markSelector(root: ParentNode, adapter: string, selector: string, className: string, required = false): void {
  trackSelector(adapter, selector, markAll(root, selector, className, adapter), required);
}

function enhanceThreadToolbar(root: ParentNode, adapter: string): void {
  markSelector(root, adapter, "#pgt", "omchh-thread-toolbar");
  markSelector(root, adapter, "#visitedforums, #visitedforumstmp", "omchh-thread-back-action");
  markSelector(root, adapter, "#newspecial, #newspecialtmp", "omchh-thread-new-action");
  markSelector(root, adapter, "#post_reply, #post_replytmp", "omchh-thread-reply-action");
}

function enhanceThreadTitle(postList: Element | null, adapter: string): void {
  const titleCard = firstDirectChild(postList, "table:not(.ad)");
  trackSelector(adapter, "#postlist > table:first-child", markElement(titleCard, "omchh-thread-title-card", adapter) ? 1 : 0);
  markElement(firstDescendant(titleCard, "td.pls"), "omchh-thread-stat-rail", adapter);
  markElement(firstDescendant(titleCard, ".hm"), "omchh-thread-stat-stack", adapter);
  markElement(firstDescendant(titleCard, "td.plc.vwthd, td.vwthd"), "omchh-thread-title-area", adapter);
  markElement(firstDescendant(titleCard, ".vwthd .y, td.plc .y"), "omchh-thread-nav-actions", adapter);
  markElement(firstDescendant(titleCard, ".ts"), "omchh-thread-heading", adapter);
  markElement(firstDescendant(titleCard, "#thread_subject"), "omchh-thread-subject", adapter);
  markAllInside(titleCard, ".vwthd > .xg1, td.plc > .xg1", "omchh-thread-copy-action", adapter);
  markAllInside(postList, "table.ad", "omchh-thread-ad-spacer", adapter);
}

function enhancePostAuthor(authorCell: Element | null, adapter: string): void {
  markElement(authorCell, "omchh-post-author", adapter);
  const authorCard = firstDescendant(authorCell, ".favatar");
  markElement(authorCard, "omchh-post-author-card", adapter);
  markElement(firstDescendant(authorCell, ".favatar > .pi, .pi"), "omchh-post-author-head", adapter);
  markElement(firstDescendant(authorCell, ".authi"), "omchh-post-author-name", adapter);
  const avatar = firstDescendant(authorCell, ".avatar");
  const avatarShell = avatar?.parentElement ?? null;
  markElement(avatarShell, "omchh-post-avatar-shell", adapter);
  markElement(avatar, "omchh-post-avatar", adapter);
  markElement(firstDescendant(authorCell, ".tns"), "omchh-post-author-stats", adapter);
  markAllInside(authorCell, ".p_pop.bui", "omchh-post-author-popover", adapter);
  directChildrenMatching(authorCard, "p:not(.xg1):not(.md_ctrl)").forEach((rankElement) => {
    markElement(rankElement, "omchh-post-author-rank", adapter);
    const identity = getRankBadgeIdentity(rankElement.textContent ?? "");
    applyRankIdentity(identity, [rankElement, authorCell, authorCard, avatarShell, avatar]);
    if (identity) enhanceRankBadge(rankElement, identity, rankElement.textContent ?? "");
  });
  markAllInside(authorCell, ".favatar > p.xg1", "omchh-post-author-tagline", adapter);
  markAllInside(authorCell, ".pil", "omchh-post-author-details", adapter);
  markAllInside(authorCell, ".md_ctrl", "omchh-post-medals", adapter);
  markAllInside(authorCell, ".favatar > ul.o, .favatar > ul.xl", "omchh-post-author-contact", adapter);
  markAllInside(authorCell, ".pm2 a", "omchh-post-message-action", adapter);
}

function enhancePostContent(contentCell: Element | null, adapter: string): void {
  markElement(contentCell, "omchh-post-content", adapter);

  const head = firstDirectChild(contentCell, ".pi");
  markElement(head, "omchh-post-head", adapter);
  const floorLink = firstDescendant(head, "strong a[id^='postnum']");
  markElement(floorLink?.parentElement ?? null, "omchh-post-floor-shell", adapter);
  markElement(floorLink, "omchh-post-floor", adapter);
  markElement(firstDescendant(head, ".pti .authi, .authi"), "omchh-post-meta", adapter);
  markElement(firstDescendant(head, "#fj"), "omchh-post-jump", adapter);

  markElement(firstDirectChild(contentCell, ".pct"), "omchh-post-content-region", adapter);
  markElement(firstDescendant(contentCell, ".pcb"), "omchh-post-content-card", adapter);
  markElement(firstDescendant(contentCell, ".t_fsz"), "omchh-post-body-wrap", adapter);
  markElement(firstDescendant(contentCell, ".t_f"), "omchh-post-body", adapter);
  markAllInside(contentCell, ".cm", "omchh-post-comments", adapter);
  markAllInside(contentCell, "[id^='post_rate_div_']", "omchh-post-rate", adapter);
}

function enhancePostActions(table: Element, adapter: string): void {
  markAll(table, ".plm #p_btn, #p_btn", "omchh-post-favorite", adapter);
  markAll(table, ".po", "omchh-post-action-shell", adapter);
  markAll(table, ".pob", "omchh-post-action-bar", adapter);
  markAll(table, ".pob a", "omchh-post-action", adapter);
}

function enhancePosts(postList: Element | null, adapter: string): void {
  const shells = directChildrenMatching(postList, "div[id^='post_']");
  shells.forEach((shell, index) => {
    markElement(shell, "omchh-post-shell", adapter);
    setData(shell, "omchhPostIndex", String(index));
    setData(shell, "omchhPostRole", index === 0 ? "original" : "reply");

    const table = firstDirectChild(shell, "table.plhin");
    markElement(table, "omchh-post", adapter);
    setData(table, "omchhPostIndex", String(index));
    setData(table, "omchhPostRole", index === 0 ? "original" : "reply");

    const firstRow = firstDirectChild(firstDirectChild(table, "tbody"), "tr");
    const authorCell = firstDirectChild(firstRow, "td.pls");
    const contentCell = firstDirectChild(firstRow, "td.plc");
    enhancePostAuthor(authorCell, adapter);
    enhancePostContent(contentCell, adapter);
    if (table) enhancePostActions(table, adapter);
  });
  trackSelector(adapter, "#postlist > div[id^='post_']", shells.length);
}

function enhanceQuickReply(root: ParentNode, adapter: string): void {
  const count = markAll(root, "#f_pst", "omchh-quick-reply", adapter);
  trackSelector(adapter, "#f_pst", count);

  const quickReply = root.querySelector("#f_pst");
  markElement(firstDescendant(quickReply, "#fastpostform"), "omchh-thread-reply-form", adapter);
  markElement(firstDescendant(quickReply, "#fastpostform > table, form > table"), "omchh-thread-reply-layout", adapter);
  markElement(firstDescendant(quickReply, "td.pls"), "omchh-thread-reply-avatar", adapter);
  markElement(firstDescendant(quickReply, "td.plc"), "omchh-thread-reply-editor", adapter);
  markElement(firstDescendant(quickReply, "#fastpostreturn"), "omchh-thread-reply-status", adapter);
  markElement(firstDescendant(quickReply, "#fastposteditor"), "omchh-thread-reply-editor-wrap", adapter);
  markElement(firstDescendant(quickReply, ".tedt"), "omchh-thread-reply-editor-shell", adapter);
  markElement(firstDescendant(quickReply, ".tedt .bar"), "omchh-thread-reply-toolbar", adapter);
  markAllInside(quickReply, ".tedt .bar .fpd a", "omchh-thread-reply-tool", adapter);
  markElement(firstDescendant(quickReply, ".tedt .area"), "omchh-thread-reply-area", adapter);
  markElement(firstDescendant(quickReply, "#fastpostmessage, textarea[name='message']"), "omchh-thread-reply-textarea", adapter);
  markElement(firstDescendant(quickReply, "#seccheck_fastpost"), "omchh-thread-reply-security", adapter);
  markElement(firstDescendant(quickReply, ".pnpost"), "omchh-thread-reply-actions", adapter);
  markElement(firstDescendant(quickReply, "#fastpostsubmit"), "omchh-thread-reply-submit", adapter);
}

export const enhanceThreadDetail: ContentAdapter = ({ root, settings }) => {
  const adapter = "thread-detail";
  const selectors: Array<[string, string, boolean]> = [
    ["#postlist", "omchh-post-list", true]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));

  enhanceThreadToolbar(root, adapter);
  const postList = root.querySelector("#postlist");
  enhanceThreadTitle(postList, adapter);
  enhancePosts(postList, adapter);
  enhanceQuickReply(root, adapter);
  markElement(document.querySelector("#ct"), "omchh-thread-detail", adapter);
};
