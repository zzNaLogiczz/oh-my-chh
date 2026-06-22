import { runDirtyAdapters, runSharedAdapters } from "../foundation/semantics";
import type { AdapterContext, DirtyRoot, MutationSummary } from "../foundation/context";
import { scheduleHealthSave, trackSelector } from "./health";
import { createObserverScheduler } from "../foundation/observer";
import { EnhancementScope } from "./enhancement-scope";
import { detectRoute } from "../foundation/route";
import { applyThemeRoot, ensureThemeAssets } from "../theming/assets";
import { getTheme, DEFAULT_THEME_ID } from "../theming/registry";
import { warnForUnexpectedExtensionError } from "./extension-context";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged, type OmchhSettings } from "../preferences/settings";
import { flushMonitoringLog, recordMonitoringEvent, type MonitoringLogLevel } from "../preferences/monitoring-log";
import { getThemeMetadata, type ThemeId } from "../theming/catalog";
import { applyPerformanceRoot, computePerformanceState } from "./performance-mode";

const ALLOWED_HOSTS = new Set(["www.chiphell.com"]);
const SYSTEM_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

let currentSettings: OmchhSettings = DEFAULT_SETTINGS;
let initialized = false;
let settingsReady = false;
let activeThemeId: ThemeId | undefined;
let scope = new EnhancementScope();

type RefreshResult = "continue" | "reloading" | "skipped";
type RefreshSource = "initial-assets" | "dom-ready" | "observer" | "settings" | "system-color" | "manual" | "coalesced";
type RefreshMode = "full" | "incremental" | "root-only";
type RefreshOptions = {
  blockFirstPaint?: boolean;
  enhanceDom?: boolean;
  source?: RefreshSource;
  mode?: RefreshMode;
  dirtyRoots?: DirtyRoot[];
  mutationSummary?: MutationSummary;
};
type NormalizedRefreshOptions = {
  blockFirstPaint: boolean;
  enhanceDom: boolean;
  source: RefreshSource;
  mode: RefreshMode;
  dirtyRoots: DirtyRoot[];
  mutationSummary?: MutationSummary;
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
let queuedRefreshOptions: NormalizedRefreshOptions | undefined;

function normalizeRefreshOptions(opts: RefreshOptions = {}): NormalizedRefreshOptions {
  return {
    blockFirstPaint: opts.blockFirstPaint === true,
    enhanceDom: opts.enhanceDom !== false,
    source: opts.source ?? "manual",
    mode: opts.mode ?? (opts.enhanceDom === false ? "root-only" : "full"),
    dirtyRoots: opts.dirtyRoots ?? [],
    mutationSummary: opts.mutationSummary
  };
}

function mergeDirtyRoots(current: DirtyRoot[], next: DirtyRoot[]): DirtyRoot[] {
  const merged = [...current];
  for (const dirtyRoot of next) {
    if (!merged.some((existing) => existing.kind === dirtyRoot.kind && existing.element === dirtyRoot.element)) merged.push(dirtyRoot);
  }
  return merged;
}

function mergeMutationSummary(current: MutationSummary | undefined, next: MutationSummary | undefined): MutationSummary | undefined {
  if (!current) return next;
  if (!next) return current;
  return {
    mutationCount: current.mutationCount + next.mutationCount,
    childListMutations: current.childListMutations + next.childListMutations,
    attributeMutations: current.attributeMutations + next.attributeMutations,
    ignoredMutationCount: current.ignoredMutationCount + next.ignoredMutationCount,
    dirtyRoots: mergeDirtyRoots(current.dirtyRoots, next.dirtyRoots)
  };
}

function mergeRefreshMode(current: RefreshMode, next: RefreshMode): RefreshMode {
  if (current === "full" || next === "full") return "full";
  if (current === "incremental" || next === "incremental") return "incremental";
  return "root-only";
}

function mergeNormalizedRefreshOptions(current: NormalizedRefreshOptions, next: NormalizedRefreshOptions): NormalizedRefreshOptions {
  return {
    blockFirstPaint: current.blockFirstPaint || next.blockFirstPaint,
    enhanceDom: current.enhanceDom || next.enhanceDom,
    source: current.source === next.source ? current.source : "coalesced",
    mode: mergeRefreshMode(current.mode, next.mode),
    dirtyRoots: mergeDirtyRoots(current.dirtyRoots, next.dirtyRoots),
    mutationSummary: mergeMutationSummary(current.mutationSummary, next.mutationSummary)
  };
}

function mergeRefreshOptions(opts: RefreshOptions = {}): void {
  const next = normalizeRefreshOptions(opts);
  if (!queuedRefreshOptions) {
    queuedRefreshOptions = next;
    return;
  }

  queuedRefreshOptions = mergeNormalizedRefreshOptions(queuedRefreshOptions, next);
}

export const __bootstrapRefreshInternals = {
  normalizeRefreshOptions,
  mergeNormalizedRefreshOptions
};

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function recordMonitor(level: MonitoringLogLevel, source: string, message: string, fields?: Record<string, unknown>, route?: string, durationMs?: number): void {
  void recordMonitoringEvent({ level, source, message, route, durationMs, fields });
}

function recordUnexpectedError(source: string, message: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  recordMonitor("error", source, message, { error: errorMessage });
}

async function performRefresh(opts: RefreshOptions = {}): Promise<RefreshResult> {
  if (!settingsReady) return "skipped";

  const startedAt = nowMs();
  const sequence = ++refreshSequence;
  const settingsSnapshot = currentSettings;
  const routeSnapshot = detectRoute();
  const performanceState = computePerformanceState(routeSnapshot, settingsSnapshot, document);
  const trigger = opts.source ?? "manual";
  let result: RefreshResult | "error" = "skipped";
  let nextThemeId: ThemeId | undefined;

  try {
    nextThemeId = getThemeMetadata(settingsSnapshot.themeId)?.id ?? DEFAULT_THEME_ID;
    const switchResult = switchThemeIfNeeded(nextThemeId);
    if (switchResult === "reloading") {
      result = "reloading";
      return "reloading";
    }

    const primeRootBeforeAssets = opts.blockFirstPaint === true && activeThemeId === undefined;
    if (primeRootBeforeAssets) {
      applyThemeRoot(settingsSnapshot, routeSnapshot);
      applyPerformanceRoot(performanceState);
      activeThemeId = nextThemeId;
    }

    const mode = opts.mode ?? "full";
    const dirtyRoots = opts.dirtyRoots ?? [];
    const isIncrementalObserver = mode === "incremental" && opts.source === "observer" && dirtyRoots.length > 0;

    if (isIncrementalObserver && document.body) {
      const context: AdapterContext = { route: routeSnapshot, settings: settingsSnapshot, root: document, mode: "incremental", dirtyRoots };
      runDirtyAdapters(context, dirtyRoots, trackSelector);
      getTheme(nextThemeId)?.enhance(context, scope);
      scheduleHealthSave(routeSnapshot, { full: false });
      result = "continue";
      return "continue";
    }

    await ensureThemeAssets(nextThemeId, { ...opts, route: routeSnapshot });
    if (sequence !== refreshSequence && opts.enhanceDom === false) {
      result = "continue";
      return "continue";
    }

    if (!primeRootBeforeAssets) {
      applyThemeRoot(settingsSnapshot, routeSnapshot);
      applyPerformanceRoot(performanceState);
      activeThemeId = nextThemeId;
    }

    if (opts.enhanceDom === false) {
      result = "continue";
      return "continue";
    }

    if (document.body) {
      const context: AdapterContext = { route: routeSnapshot, settings: settingsSnapshot, root: document, mode: "full" };
      runSharedAdapters(routeSnapshot, settingsSnapshot, document, trackSelector);
      getTheme(nextThemeId)?.enhance(context, scope);
      scheduleHealthSave(routeSnapshot, { full: true });
      enhancedRefreshSequence = sequence;
    }

    result = "continue";
    return "continue";
  } catch (error) {
    result = "error";
    throw error;
  } finally {
    recordMonitor(result === "error" ? "error" : result === "reloading" ? "warn" : "info", "refresh", "content refresh", {
      trigger,
      result,
      enhanceDom: opts.enhanceDom !== false,
      blockFirstPaint: opts.blockFirstPaint === true,
      themeId: nextThemeId ?? settingsSnapshot.themeId,
      performanceMode: performanceState.mode,
      performanceReason: performanceState.reason,
      postCount: performanceState.postCount,
      postCountTier: performanceState.postCountTier,
      refreshMode: opts.mode ?? "full",
      dirtyRootCount: opts.dirtyRoots?.length ?? 0,
      mutationCount: opts.mutationSummary?.mutationCount ?? 0,
      ignoredMutationCount: opts.mutationSummary?.ignoredMutationCount ?? 0,
      sequence
    }, routeSnapshot, nowMs() - startedAt);
  }
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
  void requestRefresh({ enhanceDom: false, source: "system-color" }).catch((error: unknown) => {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed to apply system color-scheme change.", error);
    recordUnexpectedError("system-color", "Failed to apply system color-scheme change", error);
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

  const scheduler = createObserverScheduler((summary) => {
    if (!summary.dirtyRoots.length) return;
    void requestRefresh({
      source: "observer",
      mode: "incremental",
      dirtyRoots: summary.dirtyRoots,
      mutationSummary: summary
    }).catch((error: unknown) => {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed during observer incremental refresh.", error);
      recordUnexpectedError("observer", "Failed during observer incremental refresh", error);
    });
  });

  currentSettings = await loadSettings();
  settingsReady = true;
  subscribeToSystemColorScheme();
  window.addEventListener("pagehide", () => {
    void flushMonitoringLog("pagehide");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushMonitoringLog("visibility-hidden");
  });
  const earlyThemeReady = requestRefresh({ blockFirstPaint: true, enhanceDom: false, source: "initial-assets" }).catch((error: unknown) => {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed during early theme asset preparation.", error);
    recordUnexpectedError("initial-assets", "Failed during early theme asset preparation", error);
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
        : await requestRefresh({ blockFirstPaint: true, source: "dom-ready" });
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
    void requestRefresh({ source: "settings" }).then((result) => {
      if (result !== "reloading") {
        const root = document.querySelector("#ct") ?? document.body;
        if (root instanceof Element) {
          scheduler.requestRun({
            mutationCount: 0,
            childListMutations: 0,
            attributeMutations: 0,
            ignoredMutationCount: 0,
            dirtyRoots: [{ kind: "page-structure", element: root, reason: "manual" }]
          });
        }
      }
    }).catch((error: unknown) => {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed to apply updated settings.", error);
      recordUnexpectedError("settings", "Failed to apply updated settings", error);
    });
  });
}

void initialize().catch((error: unknown) => {
  warnForUnexpectedExtensionError("[oh-my-chh] Failed to initialize content script; releasing first-paint guard.", error);
  recordUnexpectedError("initialize", "Failed to initialize content script", error);
  markPaintReady();
});
