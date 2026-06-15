import { getThemeMetadata, type ThemeId } from "./catalog";
import { flatCleanTheme } from "./themes/flat-clean/adapter";
import { liquidGlassTheme } from "./themes/liquid-glass/adapter";
import type { ThemeModule } from "./theme-module";

export { DEFAULT_THEME_ID } from "./catalog";
export type { ThemeModule } from "./theme-module";

const registry = new Map<ThemeId, ThemeModule>();

export function registerTheme(theme: ThemeModule): void {
  if (!getThemeMetadata(theme.id)) {
    throw new Error(`Theme module has no catalog metadata: ${theme.id}`);
  }
  registry.set(theme.id, theme);
}

export function getTheme(id: ThemeId): ThemeModule | undefined {
  return registry.get(id);
}

registerTheme(liquidGlassTheme);
registerTheme(flatCleanTheme);
