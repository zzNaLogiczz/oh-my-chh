import type { OmchhSettingsShape } from "../shared/preferences-shape";
import type { OmchhRoute } from "./route";

export type SelectorTracker = (adapter: string, selector: string, count: number, required?: boolean) => void;

export interface AdapterContext {
  route: OmchhRoute;
  settings: OmchhSettingsShape;
  root: ParentNode;
}

export type ContentAdapter = (context: AdapterContext) => void;

export const noopSelectorTracker: SelectorTracker = () => undefined;
