import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";


function createLocalStorage(): Storage {
  const bucket = new Map<string, string>();
  return {
    get length() {
      return bucket.size;
    },
    clear: () => bucket.clear(),
    getItem: (key: string) => bucket.get(key) ?? null,
    key: (index: number) => [...bucket.keys()][index] ?? null,
    removeItem: (key: string) => {
      bucket.delete(key);
    },
    setItem: (key: string, value: string) => {
      bucket.set(key, value);
    }
  };
}

function mountPopupHtml(): void {
  const html = readFileSync(join(process.cwd(), "src/preferences/popup/index.html"), "utf8");
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? html;
}

function previewSyncSettings(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem("omchh:preview:sync") ?? "{}") as Record<string, unknown>;
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createLocalStorage()
  });
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("popup capability controls", () => {
  it("hides density and color-scheme controls from the popup", async () => {
    mountPopupHtml();

    await import("../../src/preferences/popup/popup");

    await vi.waitFor(() => {
      expect(document.querySelectorAll(".capability-row")).toHaveLength(2);
    });

    const visibleText = document.getElementById("capability-list")?.textContent ?? "";
    expect(visibleText).toContain("减弱玻璃效果");
    expect(visibleText).toContain("减少动效");
    expect(visibleText).not.toContain("阅读密度");
    expect(visibleText).not.toContain("色彩模式");
    expect(visibleText).not.toContain("自动跟随系统");
    expect(document.getElementById("capability-density")).toBeNull();
    expect(document.getElementById("capability-colorScheme")).toBeNull();
  });

  it("persists visible controls while keeping hidden color-scheme at the light default", async () => {
    mountPopupHtml();

    await import("../../src/preferences/popup/popup");

    const reduceGlass = await vi.waitFor(() => {
      const element = document.getElementById("capability-reduceGlass");
      expect(element).toBeInstanceOf(HTMLInputElement);
      expect(document.getElementById("save-status")?.textContent).toBe("预览模式");
      return element as HTMLInputElement;
    });

    reduceGlass.checked = true;
    reduceGlass.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(previewSyncSettings()).toMatchObject({
        reduceGlass: true,
        colorScheme: "light"
      });
    });
  });
});
