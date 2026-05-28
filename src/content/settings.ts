import { warnForUnexpectedExtensionError } from "./extension-context";

export type OmchhDensity = "compact" | "comfortable";

export type OmchhThemeId = "liquid-glass";

export interface OmchhSettings {
  themeId: OmchhThemeId;
  density: OmchhDensity;
  hideUbbEmoji: boolean;
  reduceGlass: boolean;
  reduceMotion: boolean;
  enhanceQuickReply: boolean;
}

export const DEFAULT_SETTINGS: OmchhSettings = {
  themeId: "liquid-glass",
  density: "compact",
  hideUbbEmoji: false,
  reduceGlass: false,
  reduceMotion: true,
  enhanceQuickReply: true
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof OmchhSettings>;

function normalizeSettings(raw: Partial<OmchhSettings> | undefined): OmchhSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    themeId: merged.themeId === "liquid-glass" ? merged.themeId : DEFAULT_SETTINGS.themeId,
    density: merged.density === "comfortable" ? "comfortable" : "compact",
    hideUbbEmoji: Boolean(merged.hideUbbEmoji),
    reduceGlass: Boolean(merged.reduceGlass),
    reduceMotion: Boolean(merged.reduceMotion),
    enhanceQuickReply: Boolean(merged.enhanceQuickReply)
  };
}

export async function loadSettings(): Promise<OmchhSettings> {
  try {
    const storage = globalThis.chrome?.storage?.sync;
    if (!storage) return DEFAULT_SETTINGS;
    const values = await storage.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
    return normalizeSettings(values as Partial<OmchhSettings>);
  } catch (error) {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed to load settings; using defaults.", error);
    return DEFAULT_SETTINGS;
  }
}

export function onSettingsChanged(callback: (settings: OmchhSettings) => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== "sync") return;
    if (!SETTING_KEYS.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) return;
    void loadSettings().then(callback);
  };

  try {
    globalThis.chrome?.storage?.onChanged?.addListener(onChanged);
  } catch (error) {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed to subscribe to settings changes.", error);
    return () => undefined;
  }

  return () => {
    try {
      globalThis.chrome?.storage?.onChanged?.removeListener(onChanged);
    } catch (error) {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed to unsubscribe from settings changes.", error);
    }
  };
}
