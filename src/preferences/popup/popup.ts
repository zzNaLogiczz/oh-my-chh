import { CAPABILITY_CATALOG } from "../../capabilities/catalog";
import { THEME_CATALOG } from "../../theming/catalog";
import { DEFAULT_SETTINGS, SETTINGS_KEYS, asBool, asThemeId, normalizeSettings, type OmchhSettings } from "../schema";

type Settings = OmchhSettings;
type ChromeLike = typeof chrome;
const PREVIEW_SYNC_KEY = "omchh:preview:sync";
const PREVIEW_LOCAL_KEY = "omchh:preview:local";

const HIDDEN_POPUP_CAPABILITY_KEYS = new Set(["density", "colorScheme"]);
const POPUP_CAPABILITY_CATALOG = CAPABILITY_CATALOG.filter((capability) => !HIDDEN_POPUP_CAPABILITY_KEYS.has(String(capability.settingKey)));

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

function requireElement<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Missing popup control #${id}`);
  }
  return element;
}

const controls = {
  themeId: requireElement("theme-id", HTMLSelectElement),
  capabilityList: requireElement("capability-list", HTMLElement),
  saveStatus: requireElement("save-status", HTMLElement)
};

const editableControls: Array<HTMLSelectElement | HTMLInputElement> = [controls.themeId];

let currentSettings: Settings = DEFAULT_SETTINGS;

function renderThemeOptions(): void {
  controls.themeId.replaceChildren(
    ...THEME_CATALOG.map((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.id === "liquid-glass" ? `${theme.name}（新版）` : theme.name;
      return option;
    })
  );
}

function controlId(settingKey: string): string {
  return `capability-${settingKey}`;
}

function renderCapabilityControls(): void {
  const rows = POPUP_CAPABILITY_CATALOG.map((capability) => {
    const label = document.createElement("label");
    label.className = "field-row capability-row";
    label.htmlFor = controlId(capability.settingKey);

    const text = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = capability.control.label;
    const small = document.createElement("small");
    small.textContent = capability.control.description;
    text.append(strong, small);

    let control: HTMLSelectElement | HTMLInputElement;
    if (capability.control.type === "select") {
      const select = document.createElement("select");
      select.id = controlId(capability.settingKey);
      select.name = String(capability.settingKey);
      select.setAttribute("aria-label", capability.control.label);
      select.replaceChildren(
        ...capability.control.options.map((option) => {
          const node = document.createElement("option");
          node.value = option.value;
          node.textContent = option.label;
          return node;
        })
      );
      control = select;
    } else {
      const input = document.createElement("input");
      input.id = controlId(capability.settingKey);
      input.name = String(capability.settingKey);
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      input.setAttribute("aria-label", capability.control.label);
      control = input;
    }

    editableControls.push(control);
    label.append(text, control);
    return label;
  });

  controls.capabilityList.replaceChildren(...rows);
}

function capabilityControl(settingKey: string): HTMLSelectElement | HTMLInputElement {
  const element = document.getElementById(controlId(settingKey));
  if (element instanceof HTMLSelectElement || element instanceof HTMLInputElement) return element;
  throw new Error(`Missing capability control ${settingKey}`);
}

function renderSettings(settings: Settings): void {
  currentSettings = settings;
  controls.themeId.value = settings.themeId;
  for (const capability of POPUP_CAPABILITY_CATALOG) {
    const control = capabilityControl(String(capability.settingKey));
    const value = settings[capability.settingKey];
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      control.checked = Boolean(value);
    } else {
      control.value = String(value);
    }
  }
}

function currentSettingsFromDom(): Settings {
  const next: Settings = {
    ...currentSettings,
    themeId: asThemeId(controls.themeId.value)
  };

  for (const capability of POPUP_CAPABILITY_CATALOG) {
    const control = capabilityControl(String(capability.settingKey));
    if (capability.settingKey === "reduceGlass") next.reduceGlass = asBool((control as HTMLInputElement).checked, DEFAULT_SETTINGS.reduceGlass);
    if (capability.settingKey === "reduceMotion") next.reduceMotion = asBool((control as HTMLInputElement).checked, DEFAULT_SETTINGS.reduceMotion);
  }

  return next;
}

let saveTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

async function saveSettings(): Promise<void> {
  const settings = currentSettingsFromDom();
  controls.saveStatus.textContent = "保存中…";

  try {
    await storageSet("sync", { ...settings });
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
  renderThemeOptions();
  renderCapabilityControls();
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
