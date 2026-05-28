import type { OmchhRoute } from "../router";
import type { OmchhSettings } from "../settings";
import { enhanceArticleView } from "./article-view";
import { enhanceCommon } from "./common";
import { enhanceCompose } from "./compose";
import { enhanceForumIndex } from "./forum-index";
import { enhancePortalHome } from "./portal-home";
import { enhanceProfile } from "./profile";
import { enhanceThreadDetail } from "./thread-detail";
import { enhanceThreadList } from "./thread-list";
import type { AdapterContext, ContentAdapter } from "./types";

const routeAdapters: Partial<Record<OmchhRoute, ContentAdapter>> = {
  "portal-home": enhancePortalHome,
  "forum-index": enhanceForumIndex,
  "thread-list": enhanceThreadList,
  "thread-detail": enhanceThreadDetail,
  "article-view": enhanceArticleView,
  profile: enhanceProfile,
  compose: enhanceCompose
};

export function runAdapters(route: OmchhRoute, settings: OmchhSettings, root: ParentNode = document): void {
  const context: AdapterContext = { route, settings, root };
  enhanceCommon(context);
  routeAdapters[route]?.(context);
}
