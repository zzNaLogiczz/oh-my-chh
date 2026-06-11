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

function requireElement<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Missing popup control #${id}`);
  }
  return element;
}

const controls = {
  themeId: requireElement("theme-id", HTMLSelectElement),
  saveStatus: requireElement("save-status", HTMLElement)
};

const editableControls = [controls.themeId];

let currentSettings: Settings = DEFAULT_SETTINGS;

function renderSettings(settings: Settings): void {
  currentSettings = settings;
  controls.themeId.value = settings.themeId;
}

function currentSettingsFromDom(): Settings {
  return {
    ...currentSettings,
    themeId: asThemeId(controls.themeId.value)
  };
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
  for (const control of editableControls) {
    control.addEventListener("change", () => {
      void saveSettings();
    });
  }
}

async function init(): Promise<void> {
  const storedSettings = await storageGet("sync", [...SETTINGS_KEYS]);

  renderSettings(normalizeSettings(storedSettings));
  controls.saveStatus.textContent = chromeApi ? "就绪" : "预览模式";
  bindControls();
}

void init().catch(() => {
  renderSettings(DEFAULT_SETTINGS);
  controls.saveStatus.textContent = "预览模式";
  bindControls();
});
