import { markAll, markElement } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceArticleView: ContentAdapter = ({ root }) => {
  const adapter = "article-view";
  const selectors: Array<[string, string, boolean]> = [
    [".bm.vw, .vw", "omchh-article", true],
    [".vw .h", "omchh-article-header", false],
    [".vw .d", "omchh-article-body", false],
    ["#comment", "omchh-comments", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  markElement(document.querySelector("#ct"), "omchh-article-view", adapter);
};
