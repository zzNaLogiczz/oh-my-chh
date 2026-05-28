import { markAll, markElement } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceCompose: ContentAdapter = ({ root, settings }) => {
  const adapter = "compose";
  const selectors: Array<[string, string, boolean]> = [
    ["#postform", "omchh-compose-form", true],
    ["#e_controls, .edt, .bar", "omchh-editor-toolbar", false],
    ["#e_textarea, textarea", "omchh-editor-field", false],
    ["button, input[type='submit']", "omchh-compose-action", false]
  ];
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  if (settings.enhanceQuickReply) trackSelector(adapter, "#f_pst", markAll(root, "#f_pst", "omchh-quick-reply", adapter));
  markElement(document.querySelector("#ct"), "omchh-compose", adapter);
};
