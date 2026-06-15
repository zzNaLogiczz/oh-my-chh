export type OmchhDensity = "compact" | "comfortable";
export type OmchhColorScheme = "system" | "light" | "dark";

export interface OmchhSettingsShape {
  themeId: string;
  density: OmchhDensity;
  reduceGlass: boolean;
  reduceMotion: boolean;
  enhanceQuickReply: boolean;
  colorScheme: OmchhColorScheme;
}
