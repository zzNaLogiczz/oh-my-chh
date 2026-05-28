import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceForumIndex: ContentAdapter = ({ root }) => {
  const adapter = "forum-index";
  const selectors: Array<[string, string, boolean]> = [
    ["#chart", "omchh-forum-stats", false],
    [".bm.bmw.flg", "omchh-board-group", true],
    [".bm_h h2", "omchh-board-group-title", false],
    [".bm_c", "omchh-board-group-body", false],
    [".fl_tb", "omchh-board-table", false],
    [".fl_g, .fl_tb td", "omchh-board-card", false],
    [".fl_icn_g, .fl_icn", "omchh-board-icon", false],
    ["dt", "omchh-board-title", false],
    ["dd", "omchh-board-meta", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  root.querySelectorAll(".fl_g, .fl_tb td").forEach((element, index) => setData(element, "omchhBoardIndex", String(index)));
  markElement(document.querySelector("#ct"), "omchh-forum-index", adapter);
  setData(document.querySelector("#frame84eS1v"), "chhLgPromo", "");
};
