import type { OmchhRoute } from "./router";
import type { OmchhSettings } from "./settings";

const THEME_LINK_ID = "omchh-theme-css";
const LEGACY_LIQUID_GLASS_CLASS = "chh-liquid-glass";

function removeManagedThemeLinks(): void {
  document.querySelectorAll<HTMLLinkElement>(`link#${THEME_LINK_ID}`).forEach((link) => link.remove());
}

export function applyTheme(settings: OmchhSettings, route: OmchhRoute): void {
  const root = document.documentElement;
  const isLiquidGlass = settings.themeId === "liquid-glass";

  root.dataset.omchhEnabled = "1";
  root.dataset.omchhRoute = route;
  root.dataset.omchhTheme = settings.themeId;
  root.dataset.omchhDensity = settings.density;
  root.dataset.omchhReduceGlass = settings.reduceGlass ? "1" : "0";
  root.dataset.omchhMotion = settings.reduceMotion ? "reduce" : "default";
  root.classList.toggle(LEGACY_LIQUID_GLASS_CLASS, isLiquidGlass);
  document.body?.classList.toggle(LEGACY_LIQUID_GLASS_CLASS, isLiquidGlass);

  removeManagedThemeLinks();
}
