import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountPopup } from "../../src/preferences/popup/popup-view";
import { EXCEL_PREFS_KEY } from "../../src/remake/excel/prefs";
import { EXCEL_WORKBOOK_INFO_KEY } from "../../src/remake/excel/workbook/store";

let sync: Record<string, unknown>;
let local: Record<string, unknown>;
let openOptionsPage: ReturnType<typeof vi.fn>;

function area(bucket: () => Record<string, unknown>) {
  return {
    get: async (keys?: string | string[]) => {
      if (keys === undefined) return { ...bucket() };
      return Object.fromEntries([keys].flat().filter((key) => key in bucket()).map((key) => [key, bucket()[key]]));
    },
    set: async (items: Record<string, unknown>) => { Object.assign(bucket(), items); },
    remove: async (keys: string | string[]) => { for (const key of [keys].flat()) delete bucket()[key]; }
  };
}

beforeEach(() => {
  sync = {};
  local = {};
  openOptionsPage = vi.fn();
  vi.stubGlobal("chrome", {
    storage: { sync: area(() => sync), local: area(() => local), onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: { openOptionsPage, getManifest: () => ({ version: "0.3.0" }) }
  });
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => vi.unstubAllGlobals());

const root = () => document.querySelector<HTMLElement>("#root")!;
const $ = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector)!;
const skinSelect = () => $<HTMLSelectElement>('select[data-field="skin"]');
const pickSkin = (skin: string) => {
  skinSelect().value = skin;
  skinSelect().dispatchEvent(new Event("change", { bubbles: true }));
};
const excelPanel = () => $<HTMLElement>('[data-panel="excel"]');
const press = (target: HTMLElement, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

async function mount() {
  await mountPopup(root());
}

describe("popup skin picker", () => {
  it("offers exactly the original site and the Excel disguise in a dropdown, showing the stored one", async () => {
    sync.skin = "excel";
    await mount();
    expect([...skinSelect().options].map((option) => [option.value, option.textContent])).toEqual([["original", "原版"], ["excel", "Excel 伪装"]]);
    expect(skinSelect().value).toBe("excel");
    expect(excelPanel().hidden).toBe(false);
  });

  it("saves the picked skin, drops retired keys and swaps the settings below", async () => {
    sync.displayMode = "excel";
    sync.reduceGlass = true;
    await mount();
    expect(skinSelect().value).toBe("excel");
    pickSkin("original");
    await vi.waitFor(() => expect(sync.skin).toBe("original"));
    expect(sync).not.toHaveProperty("displayMode");
    expect(sync).not.toHaveProperty("reduceGlass");
    expect(excelPanel().hidden).toBe(true);
    pickSkin("excel");
    await vi.waitFor(() => expect(sync.skin).toBe("excel"));
    expect(excelPanel().hidden).toBe(false);
  });

  it("brands itself with the extension's own icon, not a skin's look", async () => {
    await mount();
    expect($<HTMLImageElement>("img.pp-logo").getAttribute("src")).toBe("../icons/chh-icon-48.png");
    // 不再有按皮肤画的小样图
    expect(root().querySelectorAll("svg")).toHaveLength(0);
  });

  it("labels each skin's settings with the skin's name", async () => {
    sync.skin = "excel";
    await mount();
    expect(excelPanel().querySelector(".pp-caption")?.textContent).toBe("Excel 伪装");
  });

  it("has no glass, motion, density or colour settings and no explanatory copy", async () => {
    await mount();
    const text = root().textContent ?? "";
    for (const retired of ["玻璃", "动效", "密度", "色彩", "隐私", "Spectrum"]) expect(text).not.toContain(retired);
    expect(root().querySelectorAll("p")).toHaveLength(0);
  });
});

describe("Excel skin settings", () => {
  beforeEach(() => { sync.skin = "excel"; });

  it("shows the imported workbook and opens the import page", async () => {
    local[EXCEL_WORKBOOK_INFO_KEY] = { fileName: "2026Q4 对账.xlsx", sheetCount: 3, importedAt: "2026-10-21T00:00:00.000Z", truncated: false };
    await mount();
    expect($('[data-field="workbook"]').textContent).toContain("2026Q4 对账.xlsx");
    $<HTMLButtonElement>('[data-action="import"]').click();
    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });

  it("says nothing is imported yet when there is no workbook", async () => {
    await mount();
    expect($('[data-field="workbook"]').textContent).toContain("未导入");
  });

  it("saves the window title when it changes, ignoring blanks", async () => {
    await mount();
    const input = $<HTMLInputElement>('[data-field="title"]');
    expect(input.value).toBe("工作簿1.xlsx");
    input.value = "  ";
    input.dispatchEvent(new Event("change"));
    input.value = "周报.xlsx";
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(local[EXCEL_PREFS_KEY]).toMatchObject({ displayName: "周报.xlsx" }));
  });

  it("records shortcuts, refusing bare keys and a key already used by the other shortcut", async () => {
    await mount();
    const boss = $<HTMLButtonElement>('[data-shortcut="bossKey"]');
    const images = $<HTMLButtonElement>('[data-shortcut="imagesKey"]');
    expect(boss.textContent).toContain("1");
    boss.click();
    expect(boss.classList.contains("is-recording")).toBe(true);
    press(boss, { code: "KeyQ" });
    expect(boss.classList.contains("is-invalid")).toBe(true);
    expect(local[EXCEL_PREFS_KEY]).toBeUndefined();
    press(boss, { code: "KeyQ", ctrlKey: true });
    await vi.waitFor(() => expect(local[EXCEL_PREFS_KEY]).toMatchObject({ bossKey: "Ctrl+KeyQ" }));
    expect(boss.classList.contains("is-recording")).toBe(false);
    images.click();
    press(images, { code: "KeyQ", ctrlKey: true });
    expect(images.classList.contains("is-invalid")).toBe(true);
    expect(local[EXCEL_PREFS_KEY]).toMatchObject({ imagesKey: "Alt+Digit2" });
    press(images, { code: "Escape" });
    expect(images.classList.contains("is-recording")).toBe(false);
  });

  it("switches whether post images show by default", async () => {
    await mount();
    const toggle = $<HTMLInputElement>('[data-field="imagesDefault"]');
    expect(toggle.checked).toBe(true);
    toggle.click();
    await vi.waitFor(() => expect(local[EXCEL_PREFS_KEY]).toMatchObject({ imagesDefault: "hide" }));
  });
});

describe("advanced section", () => {
  it("keeps the debug log switch and log actions folded away", async () => {
    await mount();
    const details = $<HTMLDetailsElement>("details.pp-advanced");
    expect(details.open).toBe(false);
    const debug = details.querySelector<HTMLInputElement>('[data-field="debugLog"]')!;
    debug.click();
    await vi.waitFor(() => expect(sync.debugLog).toBe(true));
    expect(details.querySelector('[data-action="export-log"]')).not.toBeNull();
    expect(details.querySelector('[data-action="clear-log"]')).not.toBeNull();
  });
});
