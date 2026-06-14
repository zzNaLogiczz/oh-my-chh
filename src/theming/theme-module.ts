import type { AdapterContext } from "../foundation/context";
import type { EnhancementScope } from "../platform/enhancement-scope";
import type { ThemeId } from "./catalog";

export interface ThemeModule {
  id: ThemeId;
  enhance(ctx: AdapterContext, scope: EnhancementScope): void;
  teardown?(scope: EnhancementScope): void;
}
