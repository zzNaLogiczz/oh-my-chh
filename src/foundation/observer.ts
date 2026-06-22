import type { DirtyRoot, MutationSummary } from "./context";

export interface ObserverScheduler {
  start(): void;
  stop(): void;
  requestRun(summary?: MutationSummary): void;
}

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number };
type IdleCallbackLike = (deadline: IdleDeadlineLike) => void;
type RequestIdleLike = (callback: IdleCallbackLike, options?: { timeout: number }) => number;

const requestIdle: RequestIdleLike = globalThis.requestIdleCallback
  ? (callback, options) => globalThis.requestIdleCallback(callback, options)
  : (callback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 50);

const cancelIdle = globalThis.cancelIdleCallback
  ? (handle: number): void => globalThis.cancelIdleCallback(handle)
  : (handle: number): void => window.clearTimeout(handle);

const PAGE_ROOT_OPTIONS: MutationObserverInit = { childList: true, subtree: true };
const APPEND_PARENT_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "style", "hidden"]
};

const IGNORED_ATTRIBUTE_TARGETS = [".favatar", ".favatar *", ".p_pop.bui", ".p_pop.bui *"].join(", ");
const QUICK_REPLY_SELECTOR = "#f_pst, #f_pst *";
const COMPOSE_SELECTOR = "#postform, #postform *, #editorbox, #editorbox *, #e_body, #e_body *";

function observerTargets(): Array<{ node: Node; options: MutationObserverInit }> {
  const targets: Array<{ node: Node; options: MutationObserverInit }> = [];
  const pageRoot = document.querySelector("#wp") ?? document.querySelector("#ct") ?? document.body;
  const appendParent = document.querySelector("#append_parent");

  if (pageRoot) targets.push({ node: pageRoot, options: PAGE_ROOT_OPTIONS });
  if (appendParent && appendParent !== pageRoot) targets.push({ node: appendParent, options: APPEND_PARENT_OPTIONS });

  return targets;
}

function closestElement(node: Node | null): Element | null {
  if (!node) return null;
  if (node instanceof Element) return node;
  return node.parentElement;
}

function dirtyRootForElement(element: Element, reason: DirtyRoot["reason"]): DirtyRoot | null {
  const post = element.matches("#postlist > div[id^='post_']") ? element : element.closest("#postlist > div[id^='post_']");
  if (post) return { kind: "post", element: post, reason };

  const threadRow = element.matches("#threadlisttableid tbody[id^='stickthread_'], #threadlisttableid tbody[id^='normalthread_']")
    ? element
    : element.closest("#threadlisttableid tbody[id^='stickthread_'], #threadlisttableid tbody[id^='normalthread_']");
  if (threadRow) return { kind: "thread-list-row", element: threadRow, reason };

  const quickReply = element.matches("#f_pst") ? element : element.closest(QUICK_REPLY_SELECTOR)?.closest("#f_pst");
  if (quickReply) return { kind: "quick-reply", element: quickReply, reason };

  const quickMenu = element.matches("#qmenu_menu") ? element : element.closest("#qmenu_menu");
  if (quickMenu) return { kind: "quick-menu", element: quickMenu, reason };

  const appendPopup = element.closest("#append_parent > .p_pop, #append_parent > .p_pof, #append_parent > .sllt, #append_parent > .fwinmask, #append_parent > [id^='fwin_'], #append_parent > [id$='_menu']");
  if (appendPopup) return { kind: "append-popup", element: appendPopup, reason };

  const compose = element.matches("#postform, #editorbox, #e_body") ? element : element.closest(COMPOSE_SELECTOR)?.closest("#postform, #editorbox, #e_body");
  if (compose) return { kind: "compose-editor", element: compose, reason };

  return null;
}

function emptySummary(): MutationSummary {
  return { mutationCount: 0, childListMutations: 0, attributeMutations: 0, ignoredMutationCount: 0, dirtyRoots: [] };
}

function pushDirtyRoot(summary: MutationSummary, dirtyRoot: DirtyRoot | null): void {
  if (!dirtyRoot) return;
  const duplicate = summary.dirtyRoots.some((existing) => existing.kind === dirtyRoot.kind && existing.element === dirtyRoot.element);
  if (!duplicate) summary.dirtyRoots.push(dirtyRoot);
}

function summarizeMutations(mutations: MutationRecord[]): MutationSummary {
  const summary = emptySummary();
  summary.mutationCount = mutations.length;

  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      summary.childListMutations += 1;
      mutation.addedNodes.forEach((node) => {
        const element = closestElement(node);
        if (element) pushDirtyRoot(summary, dirtyRootForElement(element, "child-list"));
      });
      continue;
    }

    if (mutation.type === "attributes") {
      summary.attributeMutations += 1;
      const target = closestElement(mutation.target);
      if (!target) {
        summary.ignoredMutationCount += 1;
        continue;
      }
      if (target.matches(IGNORED_ATTRIBUTE_TARGETS)) {
        summary.ignoredMutationCount += 1;
        continue;
      }
      const dirtyRoot = dirtyRootForElement(target, "attribute");
      if (dirtyRoot) pushDirtyRoot(summary, dirtyRoot);
      else summary.ignoredMutationCount += 1;
    }
  }

  return summary;
}

function mergeSummaries(base: MutationSummary, next: MutationSummary): MutationSummary {
  base.mutationCount += next.mutationCount;
  base.childListMutations += next.childListMutations;
  base.attributeMutations += next.attributeMutations;
  base.ignoredMutationCount += next.ignoredMutationCount;
  next.dirtyRoots.forEach((dirtyRoot) => pushDirtyRoot(base, dirtyRoot));
  return base;
}

export function createObserverScheduler(run: (summary: MutationSummary) => void): ObserverScheduler {
  let observer: MutationObserver | undefined;
  let scheduled: number | undefined;
  let pendingSummary: MutationSummary | undefined;

  const requestRun = (summary: MutationSummary = emptySummary()): void => {
    pendingSummary = pendingSummary ? mergeSummaries(pendingSummary, summary) : mergeSummaries(emptySummary(), summary);
    if (!pendingSummary.dirtyRoots.length) return;
    if (scheduled !== undefined) return;

    scheduled = requestIdle(() => {
      scheduled = undefined;
      const summaryToRun = pendingSummary;
      pendingSummary = undefined;
      if (summaryToRun?.dirtyRoots.length) run(summaryToRun);
    }, { timeout: 500 });
  };

  const start = (): void => {
    const targets = observerTargets();
    if (!targets.length || observer) return;
    observer = new MutationObserver((mutations) => requestRun(summarizeMutations(mutations)));
    targets.forEach(({ node, options }) => observer?.observe(node, options));
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = undefined;
    pendingSummary = undefined;
    if (scheduled !== undefined) {
      cancelIdle(scheduled);
      scheduled = undefined;
    }
  };

  return { start, stop, requestRun };
}
