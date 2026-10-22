// 工具栏弹窗：下拉选皮肤（原版 / Excel 伪装），下面只出现当前皮肤自己的设置；调试日志收在「高级」里
// 弹窗本身是中性的通用样式，不沿用任何一个皮肤的风格
import { formatShortcut, shortcutFromEvent } from "../../remake/excel/keys";
import type { OmchhSettings, OmchhSkin } from "../schema";
import {
  clearMonitoring, exportMonitoringLog, loadExcelPrefs, loadSettings, loadWorkbookInfo, monitoringStatusText,
  saveExcelPrefs, saveSettings, type ExcelPrefs, type WorkbookInfo
} from "./popup-model";

type ShortcutField = "bossKey" | "imagesKey";

const IS_MAC = /Mac|iPhone|iPad/i.test(globalThis.navigator?.platform ?? "");
const MAC_KEYS: Record<string, string> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘" };
const SAVED_TOAST_MS = 1400;

/** 皮肤列表：下拉框的选项和各皮肤的设置分组都从这里来，加皮肤只加一条 */
const SKINS: Array<[OmchhSkin, string]> = [["original", "原版"], ["excel", "Excel 伪装"]];
const SKIN_OPTIONS = SKINS.map(([skin, name]) => `<option value="${skin}">${name}</option>`).join("");
const skinName = (skin: OmchhSkin) => SKINS.find(([id]) => id === skin)?.[1] ?? skin;

const TEMPLATE = `
  <main class="pp">
    <header class="pp-head">
      <img class="pp-logo" src="../icons/chh-icon-48.png" alt="" width="22" height="22">
      <span class="pp-brand">oh-my-chh</span>
      <span class="pp-version"></span>
      <span class="pp-toast" role="status" aria-live="polite"></span>
    </header>
    <section class="pp-group">
      <label class="pp-row">
        <span class="pp-label">皮肤</span>
        <span class="pp-select"><select data-field="skin">${SKIN_OPTIONS}</select></span>
      </label>
    </section>
    <section class="pp-section" data-panel="excel" hidden>
      <h2 class="pp-caption">${skinName("excel")}</h2>
      <div class="pp-group">
        <div class="pp-row">
          <span class="pp-label">工作簿</span>
          <span class="pp-value" data-field="workbook"></span>
          <button type="button" class="pp-link" data-action="import"></button>
        </div>
        <label class="pp-row">
          <span class="pp-label">窗口标题</span>
          <span class="pp-title"><input data-field="title" maxlength="120" spellcheck="false" autocomplete="off"><span class="pp-suffix">- Excel</span></span>
        </label>
        <div class="pp-row">
          <span class="pp-label">老板键</span>
          <button type="button" class="pp-keys" data-shortcut="bossKey" aria-label="录制老板键"></button>
        </div>
        <div class="pp-row">
          <span class="pp-label">图片开关</span>
          <button type="button" class="pp-keys" data-shortcut="imagesKey" aria-label="录制图片开关键"></button>
        </div>
        <label class="pp-row">
          <span class="pp-label">默认显示图片</span>
          <input type="checkbox" role="switch" class="pp-switch" data-field="imagesDefault">
        </label>
      </div>
    </section>
    <details class="pp-advanced">
      <summary>高级</summary>
      <div class="pp-group">
        <label class="pp-row">
          <span class="pp-label">调试日志</span>
          <input type="checkbox" role="switch" class="pp-switch" data-field="debugLog">
        </label>
        <div class="pp-row">
          <span class="pp-label">日志</span>
          <span class="pp-value" data-field="log"></span>
          <button type="button" class="pp-link" data-action="export-log">导出</button>
          <button type="button" class="pp-link" data-action="clear-log">清空</button>
        </div>
      </div>
    </details>
  </main>`;

/** 快捷键 → 一组键帽文字；macOS 用 ⌃ ⌥ ⇧ ⌘ */
function keycaps(spec: string): string[] {
  return formatShortcut(spec).split("+").map((part) => (IS_MAC ? MAC_KEYS[part] ?? part : part));
}

/** 必须带 Ctrl / Alt / ⌘，或者是 F1–F12：否则在 Excel 里打字（比如查找框）会误触 */
function shortcutProblem(spec: string, other: string): string | null {
  const parts = spec.split("+");
  const key = parts[parts.length - 1];
  const hasModifier = parts.some((part) => part === "Ctrl" || part === "Alt" || part === "Meta");
  if (!hasModifier && !/^F([1-9]|1[0-2])$/.test(key)) return IS_MAC ? "需带 ⌃ ⌥ ⌘" : "需带 Ctrl / Alt";
  if (spec === other) return "已被占用";
  return null;
}

export async function mountPopup(root: HTMLElement): Promise<void> {
  root.innerHTML = TEMPLATE;
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const toast = $(".pp-toast");
  let toastTimer = 0;
  const flash = (message: string, failed = false) => {
    toast.textContent = message;
    toast.classList.toggle("is-error", failed);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), SAVED_TOAST_MS);
  };
  const guard = (task: Promise<unknown>) => task.then(() => flash("已保存")).catch(() => flash("保存失败", true));

  // 初始状态：设置、Excel 偏好、工作簿摘要、日志用量并行读取
  const [storedSettings, storedPrefs, workbook] = await Promise.all([loadSettings(), loadExcelPrefs(), loadWorkbookInfo()]);
  let settings = storedSettings;
  let prefs = storedPrefs;
  $(".pp-version").textContent = globalThis.chrome?.runtime?.getManifest?.().version ?? "";

  // ---- 皮肤：下拉选择，下面只显示所选皮肤自己的设置分组 ----
  const skinSelect = $<HTMLSelectElement>('select[data-field="skin"]');
  const renderSkin = () => {
    skinSelect.value = settings.skin;
    for (const panel of root.querySelectorAll<HTMLElement>("[data-panel]")) panel.hidden = panel.dataset.panel !== settings.skin;
  };
  skinSelect.addEventListener("change", () => {
    const skin = skinSelect.value as OmchhSkin;
    if (skin === settings.skin) return;
    settings = { ...settings, skin };
    renderSkin();
    void guard(saveSettings(settings));
  });

  // ---- Excel：工作簿 ----
  const renderWorkbook = (info: WorkbookInfo | null) => {
    const field = $('[data-field="workbook"]');
    field.textContent = info ? info.fileName : "未导入";
    field.classList.toggle("is-empty", !info);
    field.title = info ? `${info.fileName} · ${info.sheetCount} 个工作表${info.truncated ? " · 已截断" : ""}` : "";
    $('[data-action="import"]').textContent = info ? "更换" : "导入";
  };
  // 文件选择框会让弹窗失焦关闭，导入放在单独的标签页里做
  $('[data-action="import"]').addEventListener("click", () => { void globalThis.chrome?.runtime?.openOptionsPage?.(); });

  // ---- Excel：偏好 ----
  const savePrefs = (next: ExcelPrefs) => {
    prefs = next;
    void guard(saveExcelPrefs(prefs));
  };
  const title = $<HTMLInputElement>('[data-field="title"]');
  title.value = prefs.displayName;
  title.addEventListener("change", () => {
    const value = title.value.trim();
    if (!value) { title.value = prefs.displayName; return; }
    if (value !== prefs.displayName) savePrefs({ ...prefs, displayName: value });
  });
  title.addEventListener("keydown", (event) => { if (event.key === "Enter") title.blur(); });

  const images = $<HTMLInputElement>('[data-field="imagesDefault"]');
  images.checked = prefs.imagesDefault === "show";
  images.addEventListener("change", () => savePrefs({ ...prefs, imagesDefault: images.checked ? "show" : "hide" }));

  // 快捷键录制：点一下键帽进入录制，按下组合键即保存；Esc / 失焦取消
  const renderKeys = (button: HTMLButtonElement, caps: string[]) => {
    button.textContent = "";
    for (const cap of caps) {
      const kbd = document.createElement("kbd");
      kbd.textContent = cap;
      button.append(kbd);
    }
  };
  const bindShortcut = (button: HTMLButtonElement, field: ShortcutField, other: ShortcutField) => {
    const stop = () => {
      button.classList.remove("is-recording", "is-invalid");
      renderKeys(button, keycaps(prefs[field]));
    };
    const hint = (text: string) => {
      button.textContent = "";
      const span = document.createElement("span");
      span.className = "pp-keys-hint";
      span.textContent = text;
      button.append(span);
    };
    stop();
    button.addEventListener("click", () => {
      if (button.classList.contains("is-recording")) return;
      button.classList.add("is-recording");
      hint("按下组合键");
      button.focus();
    });
    button.addEventListener("blur", () => { if (button.classList.contains("is-recording")) stop(); });
    button.addEventListener("keydown", (event) => {
      if (!button.classList.contains("is-recording")) return;
      if (event.key === "Tab") { stop(); return; }
      event.preventDefault();
      event.stopPropagation();
      if (event.code === "Escape") { stop(); return; }
      const spec = shortcutFromEvent(event);
      if (!spec) return;
      const problem = shortcutProblem(spec, prefs[other]);
      if (problem) {
        button.classList.add("is-invalid");
        hint(problem);
        return;
      }
      savePrefs({ ...prefs, [field]: spec });
      stop();
    });
  };
  bindShortcut($<HTMLButtonElement>('[data-shortcut="bossKey"]'), "bossKey", "imagesKey");
  bindShortcut($<HTMLButtonElement>('[data-shortcut="imagesKey"]'), "imagesKey", "bossKey");

  // ---- 高级：调试日志 ----
  const debug = $<HTMLInputElement>('[data-field="debugLog"]');
  debug.checked = settings.debugLog;
  debug.addEventListener("change", () => {
    settings = { ...settings, debugLog: debug.checked } satisfies OmchhSettings;
    void guard(saveSettings(settings));
  });
  const logStatus = $('[data-field="log"]');
  const refreshLog = () => monitoringStatusText().then((text) => { logStatus.textContent = text; }).catch(() => { logStatus.textContent = "—"; });
  $('[data-action="export-log"]').addEventListener("click", () => {
    void exportMonitoringLog().then(() => flash("已导出")).catch(() => flash("导出失败", true));
  });
  $('[data-action="clear-log"]').addEventListener("click", () => {
    void clearMonitoring().then(refreshLog).then(() => flash("已清空")).catch(() => flash("清空失败", true));
  });

  renderSkin();
  renderWorkbook(workbook);
  void refreshLog();
}
