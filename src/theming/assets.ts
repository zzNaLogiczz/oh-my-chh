import type { OmchhRoute } from "../foundation/route";
import type { OmchhSettingsShape } from "../shared/preferences-shape";
import { CAPABILITY_CATALOG } from "../capabilities/catalog";
import { DEFAULT_THEME_ID, getThemeMetadata, THEME_CATALOG, type ThemeMetadata } from "./catalog";

export const THEME_LINK_ID = "omchh-theme-css";
export const PREFLIGHT_LINK_ID = "omchh-theme-preflight";
export const ASSET_LOAD_TIMEOUT_MS = 800;

function knownLegacyRootClasses(): string[] {
  return THEME_CATALOG.map((theme) => theme.capabilities.legacyRootClass).filter((value): value is string => Boolean(value));
}

function syncLegacyRootClass(meta: ThemeMetadata): void {
  const next = meta.capabilities.legacyRootClass;
  for (const className of knownLegacyRootClasses()) {
    document.documentElement.classList.remove(className);
    document.body?.classList.remove(className);
  }
  if (next) {
    document.documentElement.classList.add(next);
    document.body?.classList.add(next);
  }
}

export function applyThemeRoot(settings: OmchhSettingsShape, route: OmchhRoute): void {
  const root = document.documentElement;
  const meta = getThemeMetadata(settings.themeId) ?? getThemeMetadata(DEFAULT_THEME_ID)!;

  root.dataset.omchhEnabled = "1";
  root.dataset.omchhRoute = route;
  root.dataset.omchhTheme = meta.id;
  syncLegacyRootClass(meta);

  for (const capability of CAPABILITY_CATALOG) {
    root.setAttribute(capability.rootAttr, capability.toAttr(settings[capability.settingKey]));
  }
}

function themeEntrypointPath(themeId: string, entrypoint: string): string {
  return `themes/${themeId}/${entrypoint.replace(/^\.\//, "")}`;
}

function safeRuntimeUrl(path: string): string | null {
  try {
    return globalThis.chrome?.runtime?.getURL(path) ?? null;
  } catch {
    return null;
  }
}

type ManagedLinkState = {
  href: string;
  element: HTMLLinkElement;
  finalLoadPromise: Promise<boolean>;
};

const pendingLinks = new Map<string, ManagedLinkState>();

function waitForTimeout(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(false), ms);
  });
}

function waitForPaint(state: ManagedLinkState, opts: { blockFirstPaint?: boolean }): Promise<boolean> {
  const timeoutMs = opts.blockFirstPaint ? ASSET_LOAD_TIMEOUT_MS : 3000;
  return Promise.race([state.finalLoadPromise, waitForTimeout(timeoutMs)]);
}

function createPendingState(id: string, href: string, link: HTMLLinkElement): ManagedLinkState {
  const finalLoadPromise = new Promise<boolean>((resolve) => {
    link.onload = () => {
      link.dataset.omchhLoaded = "1";
      resolve(true);
    };
    link.onerror = () => {
      resolve(false);
    };
  });

  const state: ManagedLinkState = { href, element: link, finalLoadPromise };

  pendingLinks.set(id, state);
  void finalLoadPromise.finally(() => {
    const current = pendingLinks.get(id);
    if (current?.href === href && current.element === link) pendingLinks.delete(id);
  });

  return state;
}

function pendingStateForExistingLink(id: string, href: string, link: HTMLLinkElement): ManagedLinkState {
  const current = pendingLinks.get(id);
  if (current?.href === href && current.element === link) return current;
  return createPendingState(id, href, link);
}

function swapLink(id: string, path: string, opts: { blockFirstPaint?: boolean }): Promise<boolean> {
  const href = safeRuntimeUrl(path);
  if (!href) return Promise.resolve(false);

  const pending = pendingLinks.get(id);
  if (pending?.href === href && pending.element.isConnected) return waitForPaint(pending, opts);

  const old = document.querySelector<HTMLLinkElement>(`link#${id}`);
  if (old?.href === href) {
    if (old.dataset.omchhLoaded === "1") return Promise.resolve(true);
    return waitForPaint(pendingStateForExistingLink(id, href, old), opts);
  }

  const previousPending = pendingLinks.get(id);
  if (previousPending && previousPending.href !== href) pendingLinks.delete(id);

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.omchhManaged = "theme";

  const target = document.head ?? document.documentElement;
  const state = createPendingState(id, href, link);

  void state.finalLoadPromise.then((loaded) => {
    if (loaded) {
      old?.remove();
      return;
    }
    link.remove();
  });

  target.append(link);
  return waitForPaint(state, opts);
}

export async function ensureThemeAssets(themeId: string, opts: { blockFirstPaint?: boolean } = {}): Promise<boolean> {
  const meta = getThemeMetadata(themeId) ?? getThemeMetadata(DEFAULT_THEME_ID)!;
  const links = [
    swapLink(PREFLIGHT_LINK_ID, themeEntrypointPath(meta.id, meta.entrypoints.preflight), opts),
    swapLink(THEME_LINK_ID, themeEntrypointPath(meta.id, meta.entrypoints.index), opts)
  ];
  const results = await Promise.allSettled(links);
  return results.every((result) => result.status === "fulfilled" && result.value);
}
