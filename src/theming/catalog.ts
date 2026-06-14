import flatCleanManifest from "./themes/flat-clean/theme.json";
import liquidGlassManifest from "./themes/liquid-glass/theme.json";

export type ThemeId = string;

export interface ThemeMetadata {
  id: ThemeId;
  name: string;
  version: string;
  description: string;
  styleFamily?: string;
  entrypoints: {
    index: string;
    preflight: string;
    tokens?: string;
    routes?: string;
    preview?: string;
  };
  tokens: Record<string, string>;
  capabilities: {
    scopedSelectors: true;
    crossThemeImports: false;
    responsive: true;
    reducedMotion: true;
    requiresReloadOnSwitch: boolean;
    legacyRootClass?: string;
    glassReductionAttribute?: string;
  };
  routes?: string[];
}

export const DEFAULT_THEME_ID = "liquid-glass";
export const THEME_CATALOG: ThemeMetadata[] = [liquidGlassManifest as ThemeMetadata, flatCleanManifest as ThemeMetadata];
export const THEME_IDS = THEME_CATALOG.map((theme) => theme.id);

export function isKnownThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value);
}

export function getThemeMetadata(id: string): ThemeMetadata | undefined {
  return THEME_CATALOG.find((theme) => theme.id === id);
}
