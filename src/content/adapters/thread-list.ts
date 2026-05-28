import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceThreadList: ContentAdapter = ({ root, settings }) => {
  const adapter = "thread-list";
  const selectors: Array<[string, string, boolean]> = [
    [".bml.pbn", "omchh-forum-heading", false],
    ["#pgt", "omchh-list-toolbar", false],
    ["#thread_types", "omchh-thread-types", false],
    ["#threadlist", "omchh-thread-list", true],
    ["#threadlisttableid", "omchh-thread-table", false],
    ["td.by", "omchh-thread-author", false],
    ["td.num", "omchh-thread-stats", false],
    ["th.common, th.new, th.lock", "omchh-thread-title", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  const rows = root.querySelectorAll("#threadlisttableid tbody[id^='stickthread_'], #threadlisttableid tbody[id^='normalthread_']");
  rows.forEach((row, index) => {
    markElement(row, "omchh-thread-row", adapter);
    setData(row, "omchhThreadKind", row.id.startsWith("stickthread_") ? "sticky" : "normal");
    setData(row, "omchhThreadIndex", String(index));
  });
  trackSelector(adapter, "#threadlisttableid tbody[id^='stickthread_'], #threadlisttableid tbody[id^='normalthread_']", rows.length, true);
  if (settings.enhanceQuickReply) trackSelector(adapter, "#f_pst", markAll(root, "#f_pst", "omchh-quick-reply", adapter));
  markElement(document.querySelector("#ct"), "omchh-thread-list-route", adapter);
};
