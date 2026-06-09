import { markAll, markElement, setData } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

function markIndexed(root: ParentNode, selector: string, className: string, adapter: string, dataKey: string): number {
  let count = 0;
  root.querySelectorAll(selector).forEach((element, index) => {
    if (markElement(element, className, adapter)) count += 1;
    setData(element, dataKey, String(index));
  });
  return count;
}

const COMPOSE_ACTION_SELECTOR = ".pnpost button, .pnpost input[type='submit'], #postform button, #postform input[type='submit']";
const FULLSCREEN_METRIC_FALLBACKS = {
  toolbar: 52,
  statusbar: 42
};

function hiddenByDiscuz(element: HTMLElement | null): boolean {
  if (!element) return true;
  return element.hidden === true || element.style.display === "none";
}

function fixedByDiscuz(element: HTMLElement | null): boolean {
  return element?.style.position === "fixed";
}

function measuredHeight(element: HTMLElement | null, fallback: number): number {
  if (!element) return fallback;
  const rectHeight = Math.ceil(element.getBoundingClientRect().height);
  const offsetHeight = Math.ceil(element.offsetHeight);
  const inlineHeight = Number.parseFloat(element.style.height);
  return Math.max(rectHeight, offsetHeight, Number.isFinite(inlineHeight) ? Math.ceil(inlineHeight) : 0, fallback);
}

function detectComposeMode(root: ParentNode): "plain" | "rich" {
  const switcher = root.querySelector<HTMLInputElement>("#e_switchercheck");
  const iframe = root.querySelector<HTMLElement>("#e_iframe");
  const textarea = root.querySelector<HTMLElement>("#e_textarea");

  if (switcher) return switcher.checked ? "plain" : "rich";
  if (iframe && !hiddenByDiscuz(iframe)) return "rich";
  if (textarea && hiddenByDiscuz(textarea)) return "rich";
  return "plain";
}

function syncComposeEditorState(root: ParentNode, adapter: string): number {
  let count = 0;
  const editor = root.querySelector<HTMLElement>("#e_body");
  const area = root.querySelector<HTMLElement>("#e_body .area");
  const toolbar = root.querySelector<HTMLElement>("#e_controls");
  const statusbar = root.querySelector<HTMLElement>("#e_bbar");
  const body = document.body;
  const mode = detectComposeMode(root);
  const isFullscreen = fixedByDiscuz(toolbar) || fixedByDiscuz(area) || fixedByDiscuz(statusbar);

  [
    ["#e_iframe", "omchh-compose-wysiwyg"],
    ["#e_switcher", "omchh-compose-mode-switch"],
    ["#e_switchercheck", "omchh-compose-mode-check"],
    ["#e_fullswitcher", "omchh-compose-fullscreen-toggle"],
    ["#e_simple", "omchh-compose-simple-toggle"]
  ].forEach(([selector, className]) => {
    if (markElement(root.querySelector(selector), className, adapter)) count += 1;
  });

  setData(editor, "omchhComposeMode", mode);
  setData(area, "omchhComposeMode", mode);
  setData(toolbar, "omchhComposeFullscreen", isFullscreen ? "1" : "0");
  setData(area, "omchhComposeFullscreen", isFullscreen ? "1" : "0");
  setData(statusbar, "omchhComposeFullscreen", isFullscreen ? "1" : "0");

  if (body) {
    if (isFullscreen) {
      body.dataset.omchhComposeFullscreen = "1";
      body.style.setProperty("--omchh-compose-toolbar-height", `${measuredHeight(toolbar, FULLSCREEN_METRIC_FALLBACKS.toolbar)}px`);
      body.style.setProperty("--omchh-compose-statusbar-height", `${measuredHeight(statusbar, FULLSCREEN_METRIC_FALLBACKS.statusbar)}px`);
    } else {
      delete body.dataset.omchhComposeFullscreen;
      body.style.removeProperty("--omchh-compose-toolbar-height");
      body.style.removeProperty("--omchh-compose-statusbar-height");
    }
  }

  return count;
}

function markComposeActions(root: ParentNode, adapter: string): number {
  let count = 0;
  root.querySelectorAll<HTMLElement>(COMPOSE_ACTION_SELECTOR).forEach((element) => {
    if (markElement(element, "omchh-compose-action", adapter)) count += 1;
    const isPrimary = element.matches(".pnc, [name='topicsubmit'], [type='submit']");
    setData(element, "omchhComposeAction", isPrimary ? "primary" : "secondary");
  });
  return count;
}

export const enhanceCompose: ContentAdapter = ({ root, settings }) => {
  const adapter = "compose";
  const selectors: Array<[string, string, boolean]> = [
    ["#postform", "omchh-compose-form", true],
    ["#editorbox", "omchh-compose-shell", true],
    ["#editorbox > .tb", "omchh-compose-tabs", false],
    ["#postbox", "omchh-compose-workspace", true],
    ["#postbox > .pbt", "omchh-compose-subject-row", true],
    ["#subject", "omchh-compose-title-input", true],
    ["#subjectchk", "omchh-compose-subject-count", false],
    ["#attachnotice_attach, #attachnotice_img", "omchh-compose-unused-notice", false],
    ["#e_body_loading", "omchh-compose-loading", false],
    ["#e_body", "omchh-compose-editor", true],
    ["#e_controls, .edt, .bar", "omchh-editor-toolbar", false],
    ["#e_controls", "omchh-compose-toolbar", true],
    ["#e_button", "omchh-compose-tool-groups", true],
    ["#rstnotice", "omchh-compose-restore-notice", false],
    ["#e_body .area", "omchh-compose-textarea-shell", true],
    ["#e_textarea, textarea", "omchh-editor-field", false],
    ["#e_textarea", "omchh-compose-textarea", true],
    ["#e_bbar", "omchh-compose-statusbar", false],
    ["#post_extra", "omchh-compose-extra", false],
    ["#post_extra_tb", "omchh-compose-extra-tabs", false],
    ["#post_extra_c", "omchh-compose-extra-content", false],
    ["#extra_additional_c", "omchh-compose-extra-panel", false],
    ["#seccheck", "omchh-compose-security", false],
    [".pnpost", "omchh-compose-actions", true]
  ];

  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  trackSelector(adapter, "#e_button > div", markIndexed(root, "#e_button > div", "omchh-compose-tool-group", adapter, "omchhComposeToolGroup"));
  trackSelector(adapter, "#post_extra input[type='checkbox']", markIndexed(root, "#post_extra input[type='checkbox']", "omchh-compose-option", adapter, "omchhComposeOption"));
  trackSelector(adapter, COMPOSE_ACTION_SELECTOR, markComposeActions(root, adapter));
  trackSelector(adapter, "compose editor dynamic state", syncComposeEditorState(root, adapter));

  if (settings.enhanceQuickReply) trackSelector(adapter, "#f_pst", markAll(root, "#f_pst", "omchh-quick-reply", adapter));
  markElement(document.querySelector("#ct"), "omchh-compose", adapter);
};
