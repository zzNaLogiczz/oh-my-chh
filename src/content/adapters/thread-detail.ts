import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceThreadDetail: ContentAdapter = ({ root, settings }) => {
  const adapter = "thread-detail";
  const selectors: Array<[string, string, boolean]> = [
    ["#postlist", "omchh-post-list", true],
    [".plhin", "omchh-post", false],
    ["td.pls", "omchh-post-author", false],
    ["td.plc", "omchh-post-content", false],
    [".t_f", "omchh-post-body", false],
    [".authi", "omchh-post-meta", false],
    [".pob", "omchh-post-actions", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  root.querySelectorAll(".plhin").forEach((element, index) => setData(element, "omchhPostIndex", String(index)));
  if (settings.enhanceQuickReply) trackSelector(adapter, "#f_pst", markAll(root, "#f_pst", "omchh-quick-reply", adapter));
  markElement(document.querySelector("#ct"), "omchh-thread-detail", adapter);
};
