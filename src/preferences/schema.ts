// 扩展设置：只剩“皮肤”与调试日志开关。皮肤决定 chh 页面交给谁：原版（不改动）或 Excel 伪装（整页接管）

export type OmchhSkin = "original" | "excel";

export interface OmchhSettings {
  skin: OmchhSkin;
  debugLog: boolean;
}

export const DEFAULT_SETTINGS: OmchhSettings = {
  skin: "original",
  debugLog: false
};

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof OmchhSettings>;

/** 旧版设置项（液态主题、阅读密度、玻璃 / 动效开关、Excel 模式开关）：读取时用于迁移，保存时一并清掉 */
export const LEGACY_SETTINGS_KEYS = [
  "displayMode", "themeId", "density", "reduceGlass", "reduceMotion", "enhanceQuickReply", "colorScheme"
] as const;

function asSkin(raw: Record<string, unknown>): OmchhSkin {
  if (raw.skin === "excel" || raw.skin === "original") return raw.skin;
  if (raw.skin !== undefined) return DEFAULT_SETTINGS.skin;
  // 旧版本用 displayMode 开关 Excel 伪装：已开启的用户升级后直接落在 Excel 皮肤
  return raw.displayMode === "excel" ? "excel" : DEFAULT_SETTINGS.skin;
}

export function normalizeSettings(raw: Record<string, unknown> | undefined): OmchhSettings {
  const source = raw ?? {};
  return {
    skin: asSkin(source),
    debugLog: typeof source.debugLog === "boolean" ? source.debugLog : DEFAULT_SETTINGS.debugLog
  };
}
