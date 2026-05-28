import { markAll, markElement } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceProfile: ContentAdapter = ({ root }) => {
  const adapter = "profile";
  const selectors: Array<[string, string, boolean]> = [
    ["#uhd", "omchh-profile-header", true],
    [".u_profile", "omchh-profile-card", false],
    [".pf_l", "omchh-profile-fields", false],
    ["#pbbs", "omchh-profile-posts", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  markElement(document.querySelector("#ct"), "omchh-profile", adapter);
};
