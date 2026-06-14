import { runSharedAdapters } from "../foundation/semantics";
import type { AdapterContext } from "../foundation/context";
import { scheduleHealthSave, trackSelector } from "./health";
import { createObserverScheduler } from "../foundation/observer";
import { EnhancementScope } from "./enhancement-scope";
import { detectRoute, type OmchhRoute } from "../foundation/route";
import { applyThemeRoot, ensureThemeAssets } from "../theming/assets";
import { getTheme, DEFAULT_THEME_ID } from "../theming/registry";
import { warnForUnexpectedExtensionError } from "./extension-context";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged, type OmchhSettings } from "../preferences/settings";
import { getThemeMetadata, type ThemeId } from "../theming/catalog";

const ALLOWED_HOSTS = new Set(["www.chiphell.com"]);

let currentSettings: OmchhSettings = DEFAULT_SETTINGS;
let currentRoute: OmchhRoute = "unknown";
let initialized = false;
let settingsReady = false;
let activeThemeId: ThemeId | undefined;
let scope = new EnhancementScope();

type RefreshResult = "continue" | "reloading" | "skipped";
type RefreshOptions = {
  blockFirstPaint?: boolean;
  enhanceDom?: boolean;
};

function markPaintReady(): void {
  document.documentElement.dataset.omchhPaintReady = "1";
}

function isAllowedHost(): boolean {
  return ALLOWED_HOSTS.has(window.location.hostname);
}

function runWhenDomReady(callback: () => Promise<void>): void {
  const run = (): void => {
    void callback().catch((error: unknown) => {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed during DOM-ready content script refresh; releasing first-paint guard.", error);
      markPaintReady();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}

function switchThemeIfNeeded(nextThemeId: ThemeId): Exclude<RefreshResult, "skipped"> {
  if (activeThemeId === undefined || activeThemeId === nextThemeId) return "continue";

  const previousTheme = getTheme(activeThemeId);
  const previousMeta = getThemeMetadata(activeThemeId);
  const nextMeta = getThemeMetadata(nextThemeId);
  if (previousMeta?.capabilities.requiresReloadOnSwitch || nextMeta?.capabilities.requiresReloadOnSwitch) {
    window.location.reload();
    return "reloading";
  }

  previousTheme?.teardown?.(scope);
  scope.teardown();
  scope = new EnhancementScope();
  return "continue";
}

async function refresh(opts: RefreshOptions = {}): Promise<RefreshResult> {
  if (!settingsReady) return "skipped";

  currentRoute = detectRoute();
  const nextThemeId = getThemeMetadata(currentSettings.themeId)?.id ?? DEFAULT_THEME_ID;
  const switchResult = switchThemeIfNeeded(nextThemeId);
  if (switchResult === "reloading") return "reloading";

  await ensureThemeAssets(nextThemeId, opts);
  applyThemeRoot(currentSettings, currentRoute);
  activeThemeId = nextThemeId;

  if (opts.enhanceDom === false) return "continue";

  if (document.body) {
    const context: AdapterContext = { route: currentRoute, settings: currentSettings, root: document };
    runSharedAdapters(currentRoute, currentSettings, document, trackSelector);
    getTheme(nextThemeId)?.enhance(context, scope);
    scheduleHealthSave(currentRoute);
  }

  return "continue";
}

async function initialize(): Promise<void> {
  if (initialized) return;
  if (!isAllowedHost()) {
    markPaintReady();
    return;
  }
  initialized = true;

  const scheduler = createObserverScheduler(() => {
    void refresh().catch((error: unknown) => {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed during scheduled content script refresh.", error);
    });
  });

  currentSettings = await loadSettings();
  settingsReady = true;
  const earlyThemeReady = refresh({ blockFirstPaint: true, enhanceDom: false }).catch((error: unknown) => {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed during early theme asset preparation.", error);
    return "skipped" as const;
  });

  runWhenDomReady(async () => {
    let shouldReleasePaint = true;
    try {
      const earlyResult = await earlyThemeReady;
      if (earlyResult === "reloading") {
        shouldReleasePaint = false;
        return;
      }
      const refreshResult = await refresh({ blockFirstPaint: true });
      if (refreshResult === "reloading") shouldReleasePaint = false;
    } finally {
      if (shouldReleasePaint) {
        markPaintReady();
        scheduler.start();
      }
    }
  });

  onSettingsChanged((settings) => {
    currentSettings = settings;
    void refresh().then((result) => {
      if (result !== "reloading") scheduler.requestRun();
    }).catch((error: unknown) => {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed to apply updated settings.", error);
    });
  });
}

void initialize().catch((error: unknown) => {
  warnForUnexpectedExtensionError("[oh-my-chh] Failed to initialize content script; releasing first-paint guard.", error);
  markPaintReady();
});
