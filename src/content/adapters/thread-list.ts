import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

function directChildrenMatching(element: Element, selector: string): Element[] {
  return Array.from(element.children).filter((child) => child.matches(selector));
}

function firstDirectChild(element: Element, selector: string): Element | null {
  return directChildrenMatching(element, selector)[0] ?? null;
}

function hasMeaningfulSubforumContent(row: Element): boolean {
  if (row.querySelector("td:not(.fl_icn) a[href], h2 a[href]")) return true;
  const text = (row.textContent ?? "").replace(/\s+/g, "").trim();
  return text.length > 0;
}

function getCollapseTargetId(trigger: Element, section: Element): string | null {
  const onclick = trigger.getAttribute("onclick") ?? "";
  const onclickTarget = onclick.match(/toggle_collapse\(['"]([^'"]+)['"]\)/)?.[1];
  if (onclickTarget) return onclickTarget;
  return section.querySelector<HTMLElement>(".bm_c[id]")?.id ?? null;
}

function syncCollapseAria(trigger: HTMLElement, target: HTMLElement | null): void {
  const collapsedByClass = trigger.classList.contains("tg_yes");
  const collapsedByStyle = target?.style.display === "none";
  trigger.setAttribute("aria-expanded", collapsedByClass || collapsedByStyle ? "false" : "true");
}

function enhanceSubforumCollapse(section: Element, adapter: string): void {
  const collapse = section.querySelector<HTMLElement>(".bm_h .o");
  const trigger = collapse?.querySelector<HTMLElement>("em[onclick], em");
  if (!collapse || !trigger) return;

  markElement(collapse, "omchh-subforum-collapse", adapter);

  const targetId = getCollapseTargetId(trigger, section);
  const target = targetId ? document.getElementById(targetId) : section.querySelector<HTMLElement>(".bm_c");
  if (targetId) trigger.setAttribute("aria-controls", targetId);
  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("aria-label", "收起或展开子版块");
  syncCollapseAria(trigger, target);

  if (trigger.dataset.omchhSubforumCollapseReady === "1") return;
  trigger.dataset.omchhSubforumCollapseReady = "1";
  trigger.addEventListener("click", () => window.setTimeout(() => syncCollapseAria(trigger, target), 0));
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    trigger.click();
  });
}

export const enhanceThreadList: ContentAdapter = ({ root, settings }) => {
  const adapter = "thread-list";
  const selectors: Array<[string, string, boolean]> = [
    [".bml.pbn", "omchh-forum-heading", false],
    [".bml.pbn .bm_h h1", "omchh-forum-heading-title", false],
    [".bml.pbn .bm_h .y", "omchh-forum-heading-actions", false],
    ["#pgt", "omchh-list-toolbar", false],
    ["#thread_types", "omchh-thread-types", false],
    ["#threadlist", "omchh-thread-list", true],
    ["#threadlisttableid", "omchh-thread-table", false],
    ["td.icn", "omchh-thread-icon", false],
    ["td.by", "omchh-thread-author", false],
    ["td.num", "omchh-thread-stats", false],
    ["th.common, th.new, th.lock", "omchh-thread-title", false],
    [".bm.bmw.fl .bm_h", "omchh-subforum-header", false],
    [".bm.bmw.fl .bm_h h2", "omchh-subforum-heading", false],
    [".bm.bmw.fl .bm_c", "omchh-subforum-body", false],
    [".bm.bmw.fl .fl_tb", "omchh-subforum-table", false],
    [".bm.bmw.fl .fl_icn", "omchh-subforum-icon", false],
    [".bm.bmw.fl .fl_i", "omchh-subforum-stats", false],
    [".bm.bmw.fl .fl_by", "omchh-subforum-lastpost", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));

  const headingLayouts = root.querySelectorAll(".bml.pbn .bm_h");
  headingLayouts.forEach((layout) => markElement(layout, "omchh-forum-heading-layout", adapter));
  trackSelector(adapter, ".bml.pbn .bm_h", headingLayouts.length);

  const headingTitles = root.querySelectorAll(".bml.pbn .bm_h h1");
  headingTitles.forEach((title) => {
    markElement(title, "omchh-forum-heading-title-row", adapter);

    const layout = title.parentElement;
    let meta = firstDirectChild(title, ".xs1, .i");
    if (meta && layout) layout.appendChild(meta);
    meta = meta ?? (layout ? firstDirectChild(layout, ".omchh-forum-heading-meta-row, .xs1, .i") : null);
    markElement(meta, "omchh-forum-heading-meta-row", adapter);
  });
  trackSelector(adapter, ".bml.pbn .bm_h h1", headingTitles.length);

  const subforumSections = root.querySelectorAll(".bm.bmw.fl");
  subforumSections.forEach((section, index) => {
    markElement(section, "omchh-subforum-section", adapter);
    setData(section, "omchhSubforumSectionIndex", String(index));
    enhanceSubforumCollapse(section, adapter);
  });
  trackSelector(adapter, ".bm.bmw.fl", subforumSections.length);

  const subforumRows = root.querySelectorAll(".bm.bmw.fl .fl_tb tr");
  let visibleSubforumIndex = 0;
  subforumRows.forEach((row) => {
    if (!hasMeaningfulSubforumContent(row)) {
      markElement(row, "omchh-subforum-empty", adapter);
      return;
    }

    markElement(row, "omchh-subforum-row", adapter);
    setData(row, "omchhSubforumIndex", String(visibleSubforumIndex));
    visibleSubforumIndex += 1;
    directChildrenMatching(row, "td:not([class])").forEach((cell) => markElement(cell, "omchh-subforum-title", adapter));
  });
  trackSelector(adapter, ".bm.bmw.fl .fl_tb tr", subforumRows.length);

  const rows = root.querySelectorAll("#threadlisttableid tbody[id^='stickthread_'], #threadlisttableid tbody[id^='normalthread_']");
  rows.forEach((row, index) => {
    markElement(row, "omchh-thread-row", adapter);
    setData(row, "omchhThreadKind", row.id.startsWith("stickthread_") ? "sticky" : "normal");
    setData(row, "omchhThreadIndex", String(index));

    const threadCells = firstDirectChild(row, "tr");
    if (!threadCells) return;
    markElement(firstDirectChild(threadCells, "td.icn"), "omchh-thread-icon", adapter);
    markElement(firstDirectChild(threadCells, "th"), "omchh-thread-title", adapter);
    markElement(firstDirectChild(threadCells, "td.num"), "omchh-thread-stats", adapter);
    const byCells = directChildrenMatching(threadCells, "td.by");
    if (byCells[0]) markElement(byCells[0], "omchh-thread-author", adapter);
    if (byCells.length > 1) markElement(byCells[byCells.length - 1], "omchh-thread-lastpost", adapter);
  });
  trackSelector(adapter, "#threadlisttableid tbody[id^='stickthread_'], #threadlisttableid tbody[id^='normalthread_']", rows.length, true);

  const noticeRows = root.querySelectorAll("#threadlisttableid > tbody:not([id])");
  noticeRows.forEach((row, index) => {
    if (!row.textContent?.trim()) return;
    markElement(row, "omchh-thread-notice-row", adapter);
    setData(row, "omchhThreadNoticeIndex", String(index));
  });
  trackSelector(adapter, "#threadlisttableid > tbody:not([id])", noticeRows.length);

  const separatorRows = Array.from(root.querySelectorAll("#threadlisttableid > tbody")).filter(
    (row) => row.id === "separatorline" || firstDirectChild(row, "tr.ts")
  );
  separatorRows.forEach((row) => markElement(row, "omchh-thread-separator", adapter));
  trackSelector(adapter, "#threadlisttableid > tbody#separatorline", separatorRows.length);

  if (settings.enhanceQuickReply) trackSelector(adapter, "#f_pst", markAll(root, "#f_pst", "omchh-quick-reply", adapter));
  markElement(document.querySelector("#ct"), "omchh-thread-list-route", adapter);
};
