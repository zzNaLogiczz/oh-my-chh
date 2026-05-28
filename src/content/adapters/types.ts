import type { OmchhRoute } from "../router";
import type { OmchhSettings } from "../settings";

export interface AdapterContext {
  route: OmchhRoute;
  settings: OmchhSettings;
  root: ParentNode;
}

export type ContentAdapter = (context: AdapterContext) => void;
