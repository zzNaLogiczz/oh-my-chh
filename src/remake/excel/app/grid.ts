// Excel 网格渲染：表格 + 行列头 + 选框 + 合并 + 冻结；单元格文本一律 textContent
import type { CellStyle } from "../workbook/model";
import { columnLabel, fitFlexColumn, ROW_HEADER_PX, type GridCell, type GridModel, type GridRow } from "./grid-model";
import { scrollToReveal } from "./scroll";

export interface GridHandlers {
  onSelect(r: number, c: number, cell: GridCell | null): void;
  /** cell：被激活的格子；它自带 url 时优先于行的 url */
  onActivate(row: GridRow, cell: GridCell | null): void;
  onNearEnd(): void;
}
export interface GridHandle { appendRows(rows: GridRow[]): void; select(r: number, c: number): void; destroy(): void }

const MIN_COLUMNS = 26;
const EXTRA_ROWS = 40;
const DEFAULT_COL_PX = 64;
const DEFAULT_ROW_PX = 20;
const NEAR_END_PX = 300;

export function applyCellStyle(el: HTMLElement, style: CellStyle | undefined): void {
  if (!style) return;
  const s = el.style;
  if (style.fontFamily) s.fontFamily = `"${style.fontFamily}", var(--xl-font)`;
  if (style.fontSize) s.fontSize = `${style.fontSize}pt`;
  if (style.bold) s.fontWeight = "700";
  if (style.italic) s.fontStyle = "italic";
  const decoration = [style.underline ? "underline" : "", style.strike ? "line-through" : ""].filter(Boolean).join(" ");
  if (decoration) s.textDecoration = decoration;
  if (style.color) s.color = style.color;
  if (style.fill) s.backgroundColor = style.fill;
  if (style.hAlign) s.textAlign = style.hAlign;
  if (style.vAlign) s.verticalAlign = style.vAlign;
  if (style.wrap) { s.whiteSpace = "pre-wrap"; s.overflowWrap = "anywhere"; }
  if (style.borderTop) s.borderTop = style.borderTop;
  if (style.borderRight) s.borderRight = style.borderRight;
  if (style.borderBottom) s.borderBottom = style.borderBottom;
  if (style.borderLeft) s.borderLeft = style.borderLeft;
}

/** 合并区域：主格记录跨度，被覆盖的格子不渲染 */
function mergeIndex(model: GridModel) {
  const masters = new Map<string, { rowSpan: number; colSpan: number }>();
  const covered = new Map<string, string>();
  for (const m of model.merges) {
    masters.set(`${m.r1}:${m.c1}`, { rowSpan: m.r2 - m.r1 + 1, colSpan: m.c2 - m.c1 + 1 });
    for (let r = m.r1; r <= m.r2; r += 1) {
      for (let c = m.c1; c <= m.c2; c += 1) if (r !== m.r1 || c !== m.c1) covered.set(`${r}:${c}`, `${m.r1}:${m.c1}`);
    }
  }
  return { masters, covered };
}

export function renderGrid(host: HTMLElement, model: GridModel, handlers: GridHandlers): GridHandle {
  const rows = [...model.rows];
  const columnCount = Math.max(model.columns.length, MIN_COLUMNS);
  const widths = Array.from({ length: columnCount }, (_, c) => model.columns[c]?.width ?? DEFAULT_COL_PX);
  const { masters, covered } = mergeIndex(model);
  let selected = { r: -1, c: -1 };
  let nearEndArmed = true;

  host.classList.add("xl-grid");
  host.tabIndex = 0;
  host.textContent = "";
  const table = document.createElement("table");
  table.className = "xl-table";
  const colgroup = document.createElement("colgroup");
  for (const width of [ROW_HEADER_PX, ...widths]) {
    const col = document.createElement("col");
    col.style.width = `${width}px`;
    colgroup.append(col);
  }
  // 窗口变窄时只收窄主文本列，让右侧数据列留在可视区里
  const flexCol = model.flexColumn === undefined ? null : (colgroup.children[model.flexColumn + 1] as HTMLElement | undefined) ?? null;
  // 表格宽度钉死为列宽之和：max-content 会把长文本的多余宽度摊给所有列
  const fitColumns = () => {
    const sized = [...widths];
    if (flexCol) {
      sized[model.flexColumn!] = fitFlexColumn(model.columns, model.flexColumn!, host.clientWidth);
      flexCol.style.width = `${sized[model.flexColumn!]}px`;
    }
    table.style.width = `${sized.reduce((sum, width) => sum + width, ROW_HEADER_PX)}px`;
  };
  const resizeObserver = flexCol && typeof ResizeObserver === "function" ? new ResizeObserver(fitColumns) : null;
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "xl-corner";
  headRow.append(corner);
  for (let c = 0; c < columnCount; c += 1) {
    const th = document.createElement("th");
    th.className = "xl-colhead";
    th.dataset.c = String(c);
    th.textContent = columnLabel(c);
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  table.append(colgroup, thead, tbody);
  host.append(table);

  // 冻结窗格：前 frozenRows 行 / frozenCols 列用 sticky 固定
  const frozenTop: number[] = [];
  const frozenLeft: number[] = [];
  for (let r = 0, top = DEFAULT_ROW_PX; r < model.frozenRows; r += 1) { frozenTop.push(top); top += rows[r]?.height ?? DEFAULT_ROW_PX; }
  for (let c = 0, left = ROW_HEADER_PX; c < model.frozenCols; c += 1) { frozenLeft.push(left); left += widths[c]; }
  // sticky 区：列头 + 冻结行（上）、行号 + 冻结列（左），滚动定位时要扣掉，否则格子会被它们盖住
  const stickyTop = DEFAULT_ROW_PX + rows.slice(0, model.frozenRows).reduce((sum, row) => sum + (row?.height ?? DEFAULT_ROW_PX), 0);
  const stickyLeft = ROW_HEADER_PX + widths.slice(0, model.frozenCols).reduce((sum, width) => sum + width, 0);

  const cellElement = (r: number, c: number): HTMLElement | null => host.querySelector(`[data-r="${r}"][data-c="${c}"]`);

  function buildRow(r: number, row: GridRow | undefined): HTMLTableRowElement {
    const tr = document.createElement("tr");
    const height = row?.height ?? DEFAULT_ROW_PX;
    if (height === 0) tr.hidden = true;
    tr.style.height = `${height}px`;
    const rowHead = document.createElement("th");
    rowHead.className = "xl-rowhead";
    rowHead.textContent = String(r + 1);
    // 冻结行的行号跟着格子一起钉在顶部，否则滚动后行号会错位成别的行
    if (r < frozenTop.length) { rowHead.classList.add("xl-frozen-row"); rowHead.style.top = `${frozenTop[r]}px`; }
    tr.append(rowHead);
    for (let c = 0; c < columnCount; c += 1) {
      const key = `${r}:${c}`;
      if (covered.has(key)) continue;
      const td = document.createElement("td");
      td.dataset.r = String(r);
      td.dataset.c = String(c);
      const span = masters.get(key);
      if (span) { td.rowSpan = span.rowSpan; td.colSpan = span.colSpan; }
      const cell = row?.cells[c];
      if (cell) {
        td.textContent = cell.text;
        applyCellStyle(td, cell.style);
        if (cell.comment) td.classList.add("xl-has-comment");
        if (cell.url) td.classList.add("xl-link");
      }
      if (r < frozenTop.length) { td.classList.add("xl-frozen-row"); td.style.top = `${frozenTop[r]}px`; }
      if (c < frozenLeft.length) { td.classList.add("xl-frozen-col"); td.style.left = `${frozenLeft[c]}px`; }
      tr.append(td);
    }
    return tr;
  }

  const fragment = document.createDocumentFragment();
  for (let r = 0; r < rows.length + EXTRA_ROWS; r += 1) fragment.append(buildRow(r, rows[r]));
  tbody.append(fragment);
  fitColumns();
  resizeObserver?.observe(host);

  /** 只滚动网格自身；冻结行 / 冻结列本来就钉在原位，不参与对应方向的滚动 */
  function reveal(el: HTMLElement, r: number, c: number): void {
    const box = host.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (c >= model.frozenCols) {
      host.scrollLeft = scrollToReveal(rect.left - box.left + host.scrollLeft, rect.width, host.scrollLeft, host.clientWidth, stickyLeft);
    }
    if (r >= model.frozenRows) {
      host.scrollTop = scrollToReveal(rect.top - box.top + host.scrollTop, rect.height, host.scrollTop, host.clientHeight, stickyTop);
    }
  }

  function select(r: number, c: number): void {
    // 落在合并区域内时选中主格
    const master = covered.get(`${r}:${c}`);
    const [mr, mc] = master ? master.split(":").map(Number) : [r, c];
    host.querySelector(".xl-sel")?.classList.remove("xl-sel");
    host.querySelectorAll(".xl-head-active").forEach((el) => el.classList.remove("xl-head-active"));
    const el = cellElement(mr, mc);
    if (!el) return;
    selected = { r: mr, c: mc };
    el.classList.add("xl-sel");
    host.querySelector(`.xl-colhead[data-c="${mc}"]`)?.classList.add("xl-head-active");
    (el.parentElement?.firstElementChild as HTMLElement | null)?.classList.add("xl-head-active");
    reveal(el, mr, mc);
    handlers.onSelect(mr, mc, rows[mr]?.cells[mc] ?? null);
  }

  function activateSelected(): void {
    const row = rows[selected.r];
    const cell = row?.cells[selected.c] ?? null;
    if (row && (row.url || row.key || cell?.url)) handlers.onActivate(row, cell);
  }

  const onClick = (event: MouseEvent) => {
    const td = (event.target as HTMLElement).closest<HTMLElement>("td[data-r]");
    if (td) select(Number(td.dataset.r), Number(td.dataset.c));
  };
  const onDblClick = (event: MouseEvent) => {
    onClick(event);
    activateSelected();
  };
  const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") { event.preventDefault(); activateSelected(); return; }
    const move = MOVES[event.key];
    if (!move || selected.r < 0) return;
    event.preventDefault();
    // 从合并区域的主格往下/右移动时，跳过整个合并跨度
    const span = masters.get(`${selected.r}:${selected.c}`);
    const step = [move[0] > 0 ? span?.rowSpan ?? 1 : move[0], move[1] > 0 ? span?.colSpan ?? 1 : move[1]];
    const r = Math.max(0, selected.r + step[0]);
    const c = Math.min(columnCount - 1, Math.max(0, selected.c + step[1]));
    select(r, c);
  };
  const onScroll = () => {
    if (!nearEndArmed) return;
    if (host.scrollHeight - host.scrollTop - host.clientHeight < NEAR_END_PX) {
      nearEndArmed = false;
      handlers.onNearEnd();
    }
  };
  host.addEventListener("click", onClick);
  host.addEventListener("dblclick", onDblClick);
  host.addEventListener("keydown", onKeyDown);
  host.addEventListener("scroll", onScroll);

  return {
    appendRows(next: GridRow[]): void {
      // 追加分页数据：替换掉尾部空白行中的对应位置，再补足空白行
      const start = rows.length;
      rows.push(...next);
      const existing = [...tbody.children];
      existing.slice(start).forEach((tr) => tr.remove());
      const more = document.createDocumentFragment();
      for (let r = start; r < rows.length + EXTRA_ROWS; r += 1) more.append(buildRow(r, rows[r]));
      tbody.append(more);
      nearEndArmed = true;
    },
    select,
    destroy(): void {
      host.removeEventListener("click", onClick);
      host.removeEventListener("dblclick", onDblClick);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
      host.textContent = "";
    }
  };
}
