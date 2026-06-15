import { markAll, markElement, setData } from "../mark";
import { trackSelector } from "../selector-tracker";
import type { ContentAdapter } from "../context";

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

function getThreadTableColspan(table: Element): number {
  const firstRow = table.querySelector("tbody > tr");
  const cellCount = firstRow ? Array.from(firstRow.children).filter((cell) => cell.matches("td, th")).length : 0;
  return Math.max(cellCount, 1);
}

function createStickyCardHeader(table: HTMLElement, adapter: string): HTMLTableSectionElement {
  const doc = table.ownerDocument;
  const card = doc.createElement("tbody");
  const row = doc.createElement("tr");
  const cell = doc.createElement("td");
  const button = doc.createElement("button");
  const title = doc.createElement("span");
  const count = doc.createElement("span");
  const state = doc.createElement("span");

  markElement(card, "omchh-thread-sticky-card", adapter);
  setData(card, "omchhStickyCard", "header");
  cell.className = "omchh-thread-sticky-card-cell";
  cell.colSpan = getThreadTableColspan(table);
  button.type = "button";
  button.className = "omchh-thread-sticky-toggle";
  title.className = "omchh-thread-sticky-title";
  title.textContent = "置顶主题";
  count.className = "omchh-thread-sticky-count";
  state.className = "omchh-thread-sticky-state";
  button.append(title, count, state);
  cell.appendChild(button);
  row.appendChild(cell);
  card.appendChild(row);
  return card;
}

function getStickyRows(table: Element): HTMLElement[] {
  return directChildrenMatching(table, "tbody[id^='stickthread_']").filter((row): row is HTMLElement => row instanceof HTMLElement);
}

function syncStickyCard(table: HTMLElement, adapter: string): void {
  const stickyRows = getStickyRows(table);
  const card = firstDirectChild(table, "tbody.omchh-thread-sticky-card") as HTMLElement | null;
  const button = card?.querySelector<HTMLButtonElement>(".omchh-thread-sticky-toggle") ?? null;
  const count = card?.querySelector<HTMLElement>(".omchh-thread-sticky-count") ?? null;
  const state = card?.querySelector<HTMLElement>(".omchh-thread-sticky-state") ?? null;
  const collapsed = table.getAttribute("data-omchh-sticky-card-collapsed") === "true";

  table.setAttribute("data-omchh-sticky-card-collapsed", collapsed ? "true" : "false");
  stickyRows.forEach((row, index) => {
    markElement(row, "omchh-thread-sticky-card-item", adapter);
    setData(row, "omchhStickyCardIndex", String(index));
    row.classList.toggle("omchh-thread-sticky-card-first", index === 0);
    row.classList.toggle("omchh-thread-sticky-card-last", index === stickyRows.length - 1);
    row.hidden = collapsed;
    row.setAttribute("aria-hidden", collapsed ? "true" : "false");
  });

  if (!button) return;
  button.setAttribute("aria-controls", table.id);
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  button.setAttribute("aria-label", collapsed ? "展开置顶主题" : "收起置顶主题");
  if (count) count.textContent = `${stickyRows.length} 条`;
  if (state) state.textContent = collapsed ? "展开" : "收起";
}

function enhanceStickyThreadCard(table: Element | null, adapter: string): void {
  if (!(table instanceof HTMLElement)) return;

  const stickyRows = getStickyRows(table);
  const existingCard = firstDirectChild(table, "tbody.omchh-thread-sticky-card") as HTMLTableSectionElement | null;
  if (stickyRows.length === 0) {
    existingCard?.remove();
    table.removeAttribute("data-omchh-sticky-card-collapsed");
    return;
  }

  const card = existingCard ?? createStickyCardHeader(table, adapter);
  markElement(card, "omchh-thread-sticky-card", adapter);
  setData(card, "omchhStickyCard", "header");
  const cell = card.querySelector<HTMLTableCellElement>(".omchh-thread-sticky-card-cell");
  if (cell) cell.colSpan = getThreadTableColspan(table);
  if (card.nextElementSibling !== stickyRows[0]) table.insertBefore(card, stickyRows[0]);

  const button = card.querySelector<HTMLButtonElement>(".omchh-thread-sticky-toggle");
  if (button && button.dataset.omchhStickyToggleReady !== "1") {
    button.dataset.omchhStickyToggleReady = "1";
    button.addEventListener("click", () => {
      const nextCollapsed = table.getAttribute("data-omchh-sticky-card-collapsed") !== "true";
      table.setAttribute("data-omchh-sticky-card-collapsed", nextCollapsed ? "true" : "false");
      syncStickyCard(table, adapter);
    });
  }

  syncStickyCard(table, adapter);
}

export const enhanceThreadList: ContentAdapter = ({ root }) => {
  const adapter = "thread-list";
  const selectors: Array<[string, string, boolean]> = [
    [".bml.pbn", "omchh-forum-heading", false],
    [".bml.pbn .bm_h h1", "omchh-forum-heading-title", false],
    [".bml.pbn .bm_h .y", "omchh-forum-heading-actions", false],
    ["#pgt", "omchh-list-toolbar", false],
    ["#fd_page_top", "omchh-thread-top-pagination", false],
    ["#fd_page_bottom", "omchh-thread-bottom-pagination", false],
    ["#visitedforums, #visitedforumstmp", "omchh-thread-back-action", false],
    ["#newspecial, #newspecialtmp", "omchh-thread-new-action", false],
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

  const bottomPagination = root.querySelector("#fd_page_bottom");
  const bottomToolbar = bottomPagination?.closest(".pgs") ?? bottomPagination?.parentElement ?? null;
  trackSelector(adapter, "#fd_page_bottom closest .pgs", markElement(bottomToolbar, "omchh-thread-bottom-toolbar", adapter) ? 1 : 0);

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

  const noticeRows = root.querySelectorAll("#threadlisttableid > tbody:not([id]):not(.omchh-thread-sticky-card)");
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

  enhanceStickyThreadCard(root.querySelector("#threadlisttableid"), adapter);
  trackSelector(adapter, "#threadlisttableid > .omchh-thread-sticky-card", root.querySelectorAll("#threadlisttableid > .omchh-thread-sticky-card").length);

  trackSelector(adapter, "#f_pst", markAll(root, "#f_pst", "omchh-quick-reply", adapter));
  markElement(document.querySelector("#ct"), "omchh-thread-list-route", adapter);
};
