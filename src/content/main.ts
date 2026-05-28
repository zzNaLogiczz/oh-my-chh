import { runAdapters } from "./adapters";
import { scheduleHealthSave } from "./health";
import { createObserverScheduler } from "./dom/observer";
import { detectRoute, type OmchhRoute } from "./router";
import { applyTheme } from "./theme-loader";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged, type OmchhSettings } from "./settings";

const ALLOWED_HOSTS = new Set(["www.chiphell.com"]);

let currentSettings: OmchhSettings = DEFAULT_SETTINGS;
let currentRoute: OmchhRoute = "unknown";
let initialized = false;

function isAllowedHost(): boolean {
  return ALLOWED_HOSTS.has(window.location.hostname);
}

function refresh(): void {
  currentRoute = detectRoute();
  applyTheme(currentSettings, currentRoute);

  if (document.body) {
    runAdapters(currentRoute, currentSettings, document);
    scheduleHealthSave(currentRoute);
  }
}

function runWhenDomReady(callback: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

async function initialize(): Promise<void> {
  if (initialized || !isAllowedHost()) return;
  initialized = true;

  currentRoute = detectRoute();
  applyTheme(currentSettings, currentRoute);

  void loadSettings().then((settings) => {
    currentSettings = settings;
    refresh();
  });

  const scheduler = createObserverScheduler(refresh);

  runWhenDomReady(() => {
    refresh();
    scheduler.start();
  });

  onSettingsChanged((settings) => {
    currentSettings = settings;
    refresh();
    scheduler.requestRun();
  });
}

void initialize();
