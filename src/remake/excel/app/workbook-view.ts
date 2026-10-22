// 工作簿工作表（老板键视图）：首次切到时才渲染；可选格、可输入（仅内存，不回写文件）
import type { WbSheet, WorkbookModel } from "../workbook/model";
import { renderGrid, type GridHandle } from "./grid";
import { cellAddress, workbookGrid } from "./grid-model";

const BLANK_SHEET: WbSheet = {
  name: "Sheet1", rowCount: 0, colCount: 0, colWidths: [], rowHeights: [],
  cells: [], merges: [], frozenRows: 0, frozenCols: 0, truncated: false
};

export interface WorkbookView {
  readonly element: HTMLElement;
  ensureRendered(): void;
  focus(): void;
}

/** 在选中格上叠一个输入框：Enter 写入格子显示，Esc 放弃 */
function startCellEditor(gridHost: HTMLElement, initial: string): void {
  const target = gridHost.querySelector<HTMLElement>("td.xl-sel");
  if (!target) return;
  const editor = document.createElement("input");
  editor.className = "xl-cell-editor";
  editor.value = initial;
  const box = target.getBoundingClientRect();
  const hostBox = gridHost.getBoundingClientRect();
  editor.style.left = `${box.left - hostBox.left + gridHost.scrollLeft}px`;
  editor.style.top = `${box.top - hostBox.top + gridHost.scrollTop}px`;
  editor.style.width = `${Math.max(box.width, 80)}px`;
  editor.style.height = `${box.height || 20}px`;
  gridHost.style.position = "relative";
  gridHost.append(editor);
  editor.focus();
  const finish = (commit: boolean) => {
    if (commit) target.textContent = editor.value;
    editor.remove();
    gridHost.focus({ preventScroll: true });
  };
  editor.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  editor.addEventListener("blur", () => editor.isConnected && finish(true));
}

export function createWorkbookView(
  workbook: WorkbookModel | null, sheetIndex: number, onFormula: (address: string, text: string) => void
): WorkbookView {
  const element = document.createElement("div");
  element.className = "xl-view xl-workbook";
  let grid: GridHandle | null = null;
  const sheet = workbook?.sheets[sheetIndex] ?? BLANK_SHEET;

  return {
    element,
    ensureRendered() {
      if (grid) return;
      const gridHost = document.createElement("div");
      element.append(gridHost);
      const model = workbookGrid(sheet, workbook?.styles ?? []);
      grid = renderGrid(gridHost, model, {
        onSelect: (r, c, cell) => onFormula(cellAddress(r, c), cell?.formula ?? cell?.text ?? ""),
        onActivate: () => undefined,
        onNearEnd: () => undefined
      });
      // 直接键入可打字字符或 F2 进入编辑，看起来像在填表
      gridHost.addEventListener("keydown", (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === "F2") { event.preventDefault(); startCellEditor(gridHost, gridHost.querySelector("td.xl-sel")?.textContent ?? ""); return; }
        if (event.key.length === 1 && !event.isComposing) { event.preventDefault(); startCellEditor(gridHost, event.key); }
      });
      grid.select(0, 0);
    },
    focus: () => element.querySelector<HTMLElement>(".xl-grid")?.focus({ preventScroll: true })
  };
}
