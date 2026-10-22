import { warnForUnexpectedExtensionError } from "../platform/extension-context";
import { DEFAULT_SETTINGS, SETTINGS_KEYS, normalizeSettings, type OmchhSettings } from "./schema";

/** 读取时连同旧版 displayMode 一起取，交给 normalizeSettings 迁移 */
const READ_KEYS = [...SETTINGS_KEYS, "displayMode"];

export { DEFAULT_SETTINGS, normalizeSettings, type OmchhSettings } from "./schema";

export async function loadSettings(): Promise<OmchhSettings> {
  try {
    const storage = globalThis.chrome?.storage?.sync;
    if (!storage) return DEFAULT_SETTINGS;
    const values = await storage.get(READ_KEYS);
    return normalizeSettings(values as Record<string, unknown>);
  } catch (error) {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed to load settings; using defaults.", error);
    return DEFAULT_SETTINGS;
  }
}

export function onSettingsChanged(callback: (settings: OmchhSettings) => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== "sync") return;
    if (!SETTINGS_KEYS.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) return;
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
