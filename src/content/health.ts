import type { OmchhRoute } from "./router";
import { warnForUnexpectedExtensionError } from "./extension-context";

export interface SelectorHealthCheck {
  adapter: string;
  selector: string;
  count: number;
  required?: boolean;
}

export interface SelectorHealthReport {
  route: OmchhRoute;
  url: string;
  generatedAt: string;
  checks: SelectorHealthCheck[];
  missingRequired: SelectorHealthCheck[];
}

const checks = new Map<string, SelectorHealthCheck>();
let saveTimer: number | undefined;
const HEALTH_STORAGE_KEY = "omchh:lastHealth";

function getLocalStorage(): chrome.storage.StorageArea | undefined {
  try {
    return globalThis.chrome?.storage?.local;
  } catch (error) {
    warnForUnexpectedExtensionError("[oh-my-chh] Failed to access selector health storage.", error);
    return undefined;
  }
}

export function trackSelector(adapter: string, selector: string, count: number, required = false): void {
  checks.set(`${adapter}:${selector}`, { adapter, selector, count, required });
}

export function scheduleHealthSave(route: OmchhRoute): void {
  const storage = getLocalStorage();
  if (!storage) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const list = [...checks.values()];
    const report: SelectorHealthReport = {
      route,
      url: location.href,
      generatedAt: new Date().toISOString(),
      checks: list,
      missingRequired: list.filter((check) => check.required && check.count === 0)
    };
    try {
      void storage.set({
        [HEALTH_STORAGE_KEY]: {
          ...report,
          hitCount: list.filter((check) => check.count > 0).length,
          missingCount: report.missingRequired.length,
          hitSelectors: list.filter((check) => check.count > 0).map((check) => check.selector),
          missingSelectors: report.missingRequired.map((check) => check.selector)
        }
      })?.catch((error: unknown) => {
        warnForUnexpectedExtensionError("[oh-my-chh] Failed to save selector health report.", error);
      });
    } catch (error) {
      warnForUnexpectedExtensionError("[oh-my-chh] Failed to save selector health report.", error);
    }
  }, 250);
}
