import type { OmchhSettingsShape } from "../shared/preferences-shape";
import type { OmchhRoute } from "./route";

export type SelectorTracker = (adapter: string, selector: string, count: number, required?: boolean) => void;

export type AdapterRunMode = "full" | "incremental";

export type DirtyRootKind =
  | "post"
  | "thread-list-row"
  | "append-popup"
  | "quick-menu"
  | "quick-reply"
  | "compose-editor"
  | "page-structure";

export interface DirtyRoot {
  kind: DirtyRootKind;
  element: Element;
  reason: "child-list" | "attribute" | "manual";
}

export interface MutationSummary {
  mutationCount: number;
  childListMutations: number;
  attributeMutations: number;
  ignoredMutationCount: number;
  dirtyRoots: DirtyRoot[];
}

export interface AdapterContext {
  route: OmchhRoute;
  settings: OmchhSettingsShape;
  root: ParentNode;
  mode?: AdapterRunMode;
  dirtyRoots?: DirtyRoot[];
}

export type ContentAdapter = (context: AdapterContext) => void;

export const noopSelectorTracker: SelectorTracker = () => undefined;
