import type { OmchhRoute } from "./router";
import type { OmchhSettings } from "./settings";
import { warnForUnexpectedExtensionError } from "./extension-context";

const THEME_LINK_ID = "omchh-theme-css";
const LEGACY_LIQUID_GLASS_CLASS = "chh-liquid-glass";

function getThemeHref(themeId: string): string | undefined {
  const path = `themes/${encodeURIComponent(themeId)}/index.css`;

  try {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.getURL) return `/${path}`;
    return runtime.getURL(path);
  } catch (error) {
    warnForUnexpectedExtensionError("[oh-my-chh] Extension context unavailable; skipping theme stylesheet update.", error);
    return undefined;
  }
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

  const href = getThemeHref(settings.themeId);
  if (!href) return;

  const links = [...document.querySelectorAll<HTMLLinkElement>(`link#${THEME_LINK_ID}`)];
  let link = links[0] ?? null;
  links.slice(1).forEach((duplicate) => duplicate.remove());

  if (!link) {
    link = document.createElement("link");
    link.id = THEME_LINK_ID;
    link.rel = "stylesheet";
    link.dataset.omchhManaged = "theme";
    (document.head ?? document.documentElement).append(link);
  }
  if (link.getAttribute("href") !== href) link.href = href;
}
