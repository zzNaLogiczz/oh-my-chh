type ThemeId = "liquid-glass";
type Density = "compact" | "comfortable";

type Settings = {
  themeId: ThemeId;
  density: Density;
  enhanceQuickReply: boolean;
  hideUbbEmoji: boolean;
  reduceGlass: boolean;
  reduceMotion: boolean;
};

type HealthSummary = {
  route: string;
  hitCount: number;
  missingCount: number;
};

type ChromeLike = typeof chrome;

const DEFAULT_SETTINGS: Settings = {
  themeId: "liquid-glass",
  density: "compact",
  enhanceQuickReply: true,
  hideUbbEmoji: false,
  reduceGlass: false,
  reduceMotion: true
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>;
const HEALTH_KEY = "omchh:lastHealth";
const PREVIEW_SYNC_KEY = "omchh:preview:sync";
const PREVIEW_LOCAL_KEY = "omchh:preview:local";

const chromeApi = getChromeApi();

function getChromeApi(): ChromeLike | undefined {
  if (typeof chrome === "undefined" || !chrome.storage?.sync || !chrome.storage?.local) {
    return undefined;
  }
  return chrome;
}

function readPreviewBucket(key: string): Record<string, unknown> {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writePreviewBucket(key: string, value: Record<string, unknown>): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Preview storage is best-effort only.
  }
}

function storageGet(area: "sync" | "local", keys: string[]): Promise<Record<string, unknown>> {
  if (!chromeApi) {
    const bucket = readPreviewBucket(area === "sync" ? PREVIEW_SYNC_KEY : PREVIEW_LOCAL_KEY);
    return Promise.resolve(Object.fromEntries(keys.map((key) => [key, bucket[key]])));
  }

  return new Promise((resolve) => {
    chromeApi.storage[area].get(keys, (items) => resolve(items as Record<string, unknown>));
  });
}

function storageSet(area: "sync" | "local", items: Record<string, unknown>): Promise<void> {
  if (!chromeApi) {
    const key = area === "sync" ? PREVIEW_SYNC_KEY : PREVIEW_LOCAL_KEY;
    writePreviewBucket(key, { ...readPreviewBucket(key), ...items });
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    chromeApi.storage[area].set(items, () => {
      const message = chromeApi.runtime?.lastError?.message;
      if (message) reject(new Error(message));
      else resolve();
    });
  });
}

function asThemeId(value: unknown): ThemeId {
  return value === "liquid-glass" ? value : DEFAULT_SETTINGS.themeId;
}

function asDensity(value: unknown): Density {
  return value === "comfortable" || value === "compact" ? value : DEFAULT_SETTINGS.density;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSettings(items: Record<string, unknown>): Settings {
  return {
    themeId: asThemeId(items.themeId),
    density: asDensity(items.density),
    enhanceQuickReply: asBool(items.enhanceQuickReply, DEFAULT_SETTINGS.enhanceQuickReply),
    hideUbbEmoji: asBool(items.hideUbbEmoji, DEFAULT_SETTINGS.hideUbbEmoji),
    reduceGlass: asBool(items.reduceGlass, DEFAULT_SETTINGS.reduceGlass),
    reduceMotion: asBool(items.reduceMotion, DEFAULT_SETTINGS.reduceMotion)
  };
}

function countFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  return undefined;
}

function normalizeHealth(raw: unknown): HealthSummary {
  if (!raw || typeof raw !== "object") {
    return { route: "尚未检测", hitCount: 0, missingCount: 0 };
  }

  const item = raw as Record<string, unknown>;
  const selectors = item.selectors && typeof item.selectors === "object" ? (item.selectors as Record<string, unknown>) : {};
  const route = typeof item.route === "string" && item.route.trim() ? item.route : "未知路由";
  const hitCount =
    countFrom(item.hitCount) ??
    countFrom(item.hitSelectors) ??
    countFrom(item.hits) ??
    countFrom(item.matchedSelectors) ??
    countFrom(selectors.hit) ??
    countFrom(selectors.hits) ??
    0;
  const missingCount =
    countFrom(item.missingCount) ??
    countFrom(item.missingSelectors) ??
    countFrom(item.misses) ??
    countFrom(selectors.missing) ??
    countFrom(selectors.misses) ??
    0;

  return { route, hitCount, missingCount };
}

function requireElement<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Missing popup control #${id}`);
  }
  return element;
}

const controls = {
  themeId: requireElement("theme-id", HTMLSelectElement),
  density: requireElement("density", HTMLSelectElement),
  enhanceQuickReply: requireElement("enhance-quick-reply", HTMLInputElement),
  hideUbbEmoji: requireElement("hide-ubb-emoji", HTMLInputElement),
  reduceGlass: requireElement("reduce-glass", HTMLInputElement),
  reduceMotion: requireElement("reduce-motion", HTMLInputElement),
  healthRoute: requireElement("health-route", HTMLElement),
  healthHit: requireElement("health-hit", HTMLElement),
  healthMissing: requireElement("health-missing", HTMLElement),
  saveStatus: requireElement("save-status", HTMLElement)
};

function renderSettings(settings: Settings): void {
  controls.themeId.value = settings.themeId;
  controls.density.value = settings.density;
  controls.enhanceQuickReply.checked = settings.enhanceQuickReply;
  controls.hideUbbEmoji.checked = settings.hideUbbEmoji;
  controls.reduceGlass.checked = settings.reduceGlass;
  controls.reduceMotion.checked = settings.reduceMotion;
}

function currentSettingsFromDom(): Settings {
  return {
    themeId: asThemeId(controls.themeId.value),
    density: asDensity(controls.density.value),
    enhanceQuickReply: controls.enhanceQuickReply.checked,
    hideUbbEmoji: controls.hideUbbEmoji.checked,
    reduceGlass: controls.reduceGlass.checked,
    reduceMotion: controls.reduceMotion.checked
  };
}

function renderHealth(health: HealthSummary): void {
  controls.healthRoute.textContent = health.route;
  controls.healthHit.textContent = String(health.hitCount);
  controls.healthMissing.textContent = String(health.missingCount);
}

let saveTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

async function saveSettings(): Promise<void> {
  const settings = currentSettingsFromDom();
  controls.saveStatus.textContent = "保存中…";

  try {
    await storageSet("sync", settings);
    controls.saveStatus.textContent = "已保存";
  } catch {
    controls.saveStatus.textContent = "保存失败";
  }

  if (saveTimer !== undefined) {
    globalThis.clearTimeout(saveTimer);
  }
  saveTimer = globalThis.setTimeout(() => {
    controls.saveStatus.textContent = chromeApi ? "就绪" : "预览模式";
  }, 1400);
}

function bindControls(): void {
  for (const key of SETTINGS_KEYS) {
    controls[key].addEventListener("change", () => {
      void saveSettings();
    });
  }
}

async function init(): Promise<void> {
  const [storedSettings, storedHealth] = await Promise.all([
    storageGet("sync", [...SETTINGS_KEYS]),
    storageGet("local", [HEALTH_KEY])
  ]);

  renderSettings(normalizeSettings(storedSettings));
  renderHealth(normalizeHealth(storedHealth[HEALTH_KEY]));
  controls.saveStatus.textContent = chromeApi ? "就绪" : "预览模式";
  bindControls();
}

void init().catch(() => {
  renderSettings(DEFAULT_SETTINGS);
  renderHealth({ route: "预览不可用", hitCount: 0, missingCount: 0 });
  controls.saveStatus.textContent = "预览模式";
  bindControls();
});
