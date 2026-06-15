import type { OmchhColorScheme, OmchhDensity, OmchhSettingsShape } from "../shared/preferences-shape";
import { DEFAULT_THEME_ID, isKnownThemeId, type ThemeId } from "../theming/catalog";

export type { OmchhColorScheme, OmchhDensity } from "../shared/preferences-shape";
export type OmchhThemeId = ThemeId;

export interface OmchhSettings extends OmchhSettingsShape {
  themeId: OmchhThemeId;
}

export const DEFAULT_SETTINGS: OmchhSettings = {
  themeId: DEFAULT_THEME_ID,
  density: "compact",
  reduceGlass: false,
  reduceMotion: true,
  enhanceQuickReply: true,
  colorScheme: "light"
};

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof OmchhSettings>;

export function asThemeId(value: unknown): ThemeId {
  return isKnownThemeId(value) ? value : DEFAULT_SETTINGS.themeId;
}

export function asDensity(value: unknown): OmchhDensity {
  return value === "comfortable" || value === "compact" ? value : DEFAULT_SETTINGS.density;
}

export function asColorScheme(value: unknown): OmchhColorScheme {
  return value === "light" ? "light" : DEFAULT_SETTINGS.colorScheme;
}

export function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSettings(raw: Partial<OmchhSettingsShape> | Record<string, unknown> | undefined): OmchhSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) } as Record<string, unknown>;
  return {
    themeId: asThemeId(merged.themeId),
    density: asDensity(merged.density),
    reduceGlass: asBool(merged.reduceGlass, DEFAULT_SETTINGS.reduceGlass),
    reduceMotion: asBool(merged.reduceMotion, DEFAULT_SETTINGS.reduceMotion),
    enhanceQuickReply: asBool(merged.enhanceQuickReply, DEFAULT_SETTINGS.enhanceQuickReply),
    colorScheme: asColorScheme(merged.colorScheme)
  };
}
