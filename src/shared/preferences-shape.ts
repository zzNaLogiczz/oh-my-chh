export type OmchhDensity = "compact" | "comfortable";
export type OmchhColorScheme = "light" | "dark";

export interface OmchhSettingsShape {
  themeId: string;
  density: OmchhDensity;
  hideUbbEmoji: boolean;
  reduceGlass: boolean;
  reduceMotion: boolean;
  enhanceQuickReply: boolean;
  colorScheme: OmchhColorScheme;
}
