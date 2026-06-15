import { runSharedAdapters } from "../foundation/semantics";
import type { AdapterContext } from "../foundation/context";
import { scheduleHealthSave, trackSelector } from "./health";
import { createObserverScheduler } from "../foundation/observer";
import { EnhancementScope } from "./enhancement-scope";
import { detectRoute } from "../foundation/route";
import { applyThemeRoot, ensureThemeAssets } from "../theming/assets";
import { getTheme, DEFAULT_THEME_ID } from "../theming/registry";
import { warnForUnexpectedExtensionError } from "./extension-context";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged, type OmchhSettings } from "../preferences/settings";
import { getThemeMetadata, type ThemeId } from "../theming/catalog";

const ALLOWED_HOSTS = new Set(["www.chiphell.com"]);
const SYSTEM_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

let currentSettings: OmchhSettings = DEFAULT_SETTINGS;
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

let refreshDrainPromise: Promise<RefreshResult> | undefined;
let refreshQueued = false;
let refreshSequence = 0;
let enhancedRefreshSequence = 0;
let queuedRefreshOptions: Required<RefreshOptions> | undefined;

function normalizeRefreshOptions(opts: RefreshOptions = {}): Required<RefreshOptions> {
  return {
    blockFirstPaint: opts.blockFirstPaint === true,
    enhanceDom: opts.enhanceDom !== false
  };
}

function mergeRefreshOptions(opts: RefreshOptions = {}): void {
  const next = normalizeRefreshOptions(opts);
  if (!queuedRefreshOptions) {
    queuedRefreshOptions = next;
    return;
  }

  queuedRefreshOptions = {
    blockFirstPaint: queuedRefreshOptions.blockFirstPaint || next.blockFirstPaint,
    enhanceDom: queuedRefreshOptions.enhanceDom && next.enhanceDom
  };
}

async function performRefresh(opts: RefreshOptions = {}): Promise<RefreshResult> {
  if (!settingsReady) return "skipped";

  const sequence = ++refreshSequence;
  const settingsSnapshot = currentSettings;
  const routeSnapshot = detectRoute();

  const nextThemeId = getThemeMetadata(settingsSnapshot.themeId)?.id ?? DEFAULT_THEME_ID;
  const switchResult = switchThemeIfNeeded(nextThemeId);
  if (switchResult === "reloading") return "reloading";

  const primeRootBeforeAssets = opts.blockFirstPaint === true && activeThemeId === undefined;
  if (primeRootBeforeAssets) {
    applyThemeRoot(settingsSnapshot, routeSnapshot);
    activeThemeId = nextThemeId;
  }

  await ensureThemeAssets(nextThemeId, opts);
  if (sequence !== refreshSequence && opts.enhanceDom === false) return "continue";

  if (!primeRootBeforeAssets) {
    applyThemeRoot(settingsSnapshot, routeSnapshot);
    activeThemeId = nextThemeId;
  }

  if (opts.enhanceDom === false) return "continue";

  if (document.body) {
    const context: AdapterContext = { route: routeSnapshot, settings: settingsSnapshot, root: document };
    runSharedAdapters(routeSnapshot, settingsSnapshot, document, trackSelector);
    getTheme(nextThemeId)?.enhance(context, scope);
    scheduleHealthSave(routeSnapshot);
    enhancedRefreshSequence = sequence;
  }

  return "continue";
}

async function drainRefreshQueue(): Promise<RefreshResult> {
  let result: RefreshResult = "skipped";

  while (queuedRefreshOptions) {
    const opts = queuedRefreshOptions;
    queuedRefreshOptions = undefined;
    refreshQueued = false;

    result = await performRefresh(opts);
    if (result === "reloading") return result;

    if (refreshQueued && !queuedRefreshOptions) mergeRefreshOptions();
  }

  return result;
}

function requestRefresh(opts: RefreshOptions = {}): Promise<RefreshResult> {
  mergeRefreshOptions(opts);

  if (refreshDrainPromise) {
    refreshQueued = true;
    return refreshDrainPromise;
  }

  refreshDrainPromise = drainRefreshQueue().finally(() => {
    refreshDrainPromise = undefined;
  });

  return refreshDrainPromise;
}

function systemColorSchemeMedia(): MediaQueryList | undefined {
  try {
    return window.matchMedia?.(SYSTEM_COLOR_SCHEME_QUERY);
  } catch {
    return undefined;
  }
}

function onSystemColorSchemeChanged(): void {
  if (currentSettings.colorScheme !== "system") return;
  void requestRefresh({ enhanceDom: false }).catch((error: unknown) => {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed to apply system color-scheme change.", error);
  });
}

function subscribeToSystemColorScheme(): void {
  const media = systemColorSchemeMedia();
  if (!media) return;

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", onSystemColorSchemeChanged);
    return;
  }

  media.addListener?.(onSystemColorSchemeChanged);
}

async function initialize(): Promise<void> {
  if (initialized) return;
  if (!isAllowedHost()) {
    markPaintReady();
    return;
  }
  initialized = true;

  const scheduler = createObserverScheduler(() => {
    void requestRefresh().catch((error: unknown) => {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed during scheduled content script refresh.", error);
    });
  });

  currentSettings = await loadSettings();
  settingsReady = true;
  subscribeToSystemColorScheme();
  const earlyThemeReady = requestRefresh({ blockFirstPaint: true, enhanceDom: false }).catch((error: unknown) => {
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
      const refreshResult = enhancedRefreshSequence === refreshSequence
        ? earlyResult
        : await requestRefresh({ blockFirstPaint: true });
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
    void requestRefresh().then((result) => {
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
