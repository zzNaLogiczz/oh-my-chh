import type { OmchhSettingsShape } from "../../shared/preferences-shape";
import type { OmchhRoute } from "../route";
import { enhanceArticleView } from "./article-view";
import { enhanceCommon } from "./common";
import { enhanceCompose } from "./compose";
import { enhanceForumIndex } from "./forum-index";
import { enhanceMessages } from "./messages";
import { enhancePortalHome } from "./portal-home";
import { enhanceProfile } from "./profile";
import { enhanceSettings } from "./settings";
import { enhanceThreadDetail } from "./thread-detail";
import { enhanceThreadList } from "./thread-list";
import { noopSelectorTracker, type AdapterContext, type ContentAdapter, type SelectorTracker } from "../context";
import { withSelectorTracker } from "../selector-tracker";

const routeAdapters: Partial<Record<OmchhRoute, ContentAdapter>> = {
  "portal-home": enhancePortalHome,
  "forum-index": enhanceForumIndex,
  "thread-list": enhanceThreadList,
  "thread-detail": enhanceThreadDetail,
  "article-view": enhanceArticleView,
  profile: enhanceProfile,
  settings: enhanceSettings,
  messages: enhanceMessages,
  compose: enhanceCompose
};

export function runSharedAdapters(
  route: OmchhRoute,
  settings: OmchhSettingsShape,
  root: ParentNode = document,
  trackSelector: SelectorTracker = noopSelectorTracker
): void {
  const context: AdapterContext = { route, settings, root, mode: "full" };
  withSelectorTracker(trackSelector, () => {
    enhanceCommon(context);
    routeAdapters[route]?.(context);
  });
}

export function runDirtyAdapters(
  context: AdapterContext,
  dirtyRoots = context.dirtyRoots ?? [],
  trackSelector: SelectorTracker = noopSelectorTracker
): void {
  const incrementalContext: AdapterContext = { ...context, mode: "incremental", dirtyRoots };
  withSelectorTracker(trackSelector, () => {
    enhanceCommon(incrementalContext);
    routeAdapters[incrementalContext.route]?.(incrementalContext);
  });
}

export const runAdapters = runSharedAdapters;
