// Excel 窗口外壳：标题栏、功能区、编辑栏、工作表标签、状态栏（功能区按钮除特定项外均为装饰）
import type { NavLink } from "../model";

export type RibbonTab = "file" | "home" | "insert" | "layout" | "formulas" | "data" | "review" | "view";
export type FileCommand = "open-original" | "forum-index" | "import";

/** 论坛工作表的浏览状态：page..lastPage 是当前已加载（含滚动追加）的页码区间 */
export interface NavState {
  canBack: boolean; parent: NavLink | null;
  page: number; lastPage: number; totalPages: number; canPrev: boolean; canNext: boolean;
}
export type NavAction = { kind: "back" } | { kind: "up" } | { kind: "prev" } | { kind: "next" } | { kind: "jump"; page: number };

export interface ShellOptions {
  title: string;
  onRibbonTab(tab: RibbonTab): void;
  onFileCommand(cmd: FileCommand): void;
  onImagesToggle(checked: boolean): void;
  onSheetSelect(index: number): void;
  onNav?(action: NavAction): void;
}

export interface ShellRefs {
  root: HTMLElement;
  body: HTMLElement;
  setTitle(title: string): void;
  setActiveTab(tab: RibbonTab): void;
  setFormula(address: string, text: string): void;
  setStatus(text: string): void;
  setSheets(names: string[], active: number): void;
  setImagesChecked(checked: boolean): void;
  /** null：隐藏导航组（导入的工作表上不出现，老板键画面保持纯 Excel） */
  setNav(state: NavState | null): void;
}

const TABS: [RibbonTab, string][] = [
  ["file", "文件"], ["home", "开始"], ["insert", "插入"], ["layout", "页面布局"],
  ["formulas", "公式"], ["data", "数据"], ["review", "审阅"], ["view", "视图"]
];

type Group = { label: string; items: string[] };
const PANELS: Record<Exclude<RibbonTab, "file">, Group[]> = {
  home: [
    { label: "剪贴板", items: ["📋 粘贴", "✂ 剪切", "⧉ 复制", "🖌 格式刷"] },
    { label: "字体", items: ["等线", "11", "B", "I", "U", "田", "A"] },
    { label: "对齐方式", items: ["≡ 左", "≡ 中", "≡ 右", "⤶ 自动换行", "⊞ 合并后居中"] },
    { label: "数字", items: ["常规", "%", ",", ".0", ".00"] },
    { label: "样式", items: ["条件格式", "套用表格格式", "单元格样式"] },
    { label: "单元格", items: ["插入", "删除", "格式"] },
    { label: "编辑", items: ["Σ 自动求和", "⇅ 排序和筛选", "🔍 查找和选择"] }
  ],
  insert: [
    { label: "表格", items: ["数据透视表", "推荐的数据透视表", "表格"] },
    { label: "插图", items: ["图片", "形状", "图标"] },
    { label: "图表", items: ["推荐的图表", "柱形图", "折线图", "饼图"] },
    { label: "迷你图", items: ["折线", "柱形", "盈亏"] },
    { label: "筛选器", items: ["切片器", "日程表"] }
  ],
  layout: [
    { label: "主题", items: ["主题", "颜色", "字体"] },
    { label: "页面设置", items: ["页边距", "纸张方向", "纸张大小", "打印区域"] },
    { label: "调整为合适大小", items: ["宽度: 自动", "高度: 自动", "缩放: 100%"] }
  ],
  formulas: [
    { label: "函数库", items: ["ƒx 插入函数", "Σ 自动求和", "最近使用", "财务", "逻辑", "文本", "日期和时间"] },
    { label: "定义的名称", items: ["名称管理器", "定义名称", "用于公式"] },
    { label: "公式审核", items: ["追踪引用单元格", "显示公式", "错误检查"] },
    { label: "计算", items: ["计算选项", "开始计算"] }
  ],
  data: [
    { label: "获取和转换数据", items: ["获取数据", "自文本/CSV", "自网站"] },
    { label: "查询和连接", items: ["全部刷新", "属性"] },
    { label: "排序和筛选", items: ["↑ 升序", "↓ 降序", "排序", "筛选"] },
    { label: "数据工具", items: ["分列", "删除重复值", "数据验证"] },
    { label: "预测", items: ["模拟分析", "预测工作表"] }
  ],
  review: [
    { label: "校对", items: ["拼写检查", "同义词库"] },
    { label: "批注", items: ["新建批注", "上一条", "下一条", "显示批注"] },
    { label: "保护", items: ["保护工作表", "保护工作簿"] }
  ],
  view: [
    { label: "工作簿视图", items: ["普通", "分页预览", "页面布局"] },
    { label: "显示", items: ["☑ 网格线", "☑ 编辑栏", "☑ 标题"] },
    { label: "缩放", items: ["缩放", "100%", "缩放到选定区域"] },
    { label: "窗口", items: ["新建窗口", "全部重排", "冻结窗格"] }
  ]
};

const FILE_MENU: [FileCommand, string][] = [
  ["open-original", "在浏览器中打开原网页"],
  ["forum-index", "返回版块列表"],
  ["import", "导入工作簿…"]
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildPanel(tab: Exclude<RibbonTab, "file">): HTMLElement {
  const panel = el("div", "xl-panel");
  panel.dataset.panel = tab;
  for (const group of PANELS[tab]) {
    const box = el("div", "xl-group");
    const items = el("div", "xl-group-items");
    for (const item of group.items) items.append(el("button", "xl-cmd", item));
    if (tab === "view" && group.label === "显示") {
      // 唯一真实生效的功能区控件：帖子图片全局开关
      const label = el("label", "xl-cmd xl-check");
      const toggle = el("input");
      toggle.type = "checkbox";
      toggle.id = "xl-show-images";
      label.append(toggle, document.createTextNode(" 显示图片"));
      items.append(label);
    }
    box.append(items, el("div", "xl-group-label", group.label));
    panel.append(box);
  }
  return panel;
}

/** 功能区最左侧的“导航”组：后退 / 返回上级 / 上一页 / 页码跳转 / 下一页 */
function buildNavGroup(onNav: (action: NavAction) => void) {
  const group = el("div", "xl-group xl-navgroup");
  group.hidden = true;
  const items = el("div", "xl-group-items");
  const button = (action: "back" | "up" | "prev" | "next", label: string) => {
    const node = el("button", "xl-cmd", label);
    node.dataset.nav = action;
    node.addEventListener("click", () => onNav({ kind: action }));
    return node;
  };
  const back = button("back", "◀ 后退");
  const up = button("up", "▲ 返回上级");
  const prev = button("prev", "‹ 上一页");
  const next = button("next", "下一页 ›");
  const box = el("label", "xl-cmd xl-pagebox");
  const input = el("input", "xl-page-input");
  input.inputMode = "numeric";
  input.setAttribute("aria-label", "页码");
  const total = el("span", "xl-page-total");
  box.append("第 ", input, " / ", total, " 页");
  input.addEventListener("focus", () => input.select());
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const page = Number(input.value.trim());
    if (Number.isInteger(page) && page > 0) onNav({ kind: "jump", page });
  });
  const historyRow = el("div", "xl-navrow");
  historyRow.append(back, up);
  const pageRow = el("div", "xl-navrow");
  pageRow.append(prev, box, next);
  items.append(historyRow, pageRow);
  group.append(items, el("div", "xl-group-label", "导航"));

  return {
    group,
    set(state: NavState | null) {
      group.hidden = state === null;
      if (!state) return;
      back.disabled = !state.canBack;
      up.disabled = state.parent === null;
      up.title = state.parent ? `返回 ${state.parent.name}` : "";
      prev.disabled = !state.canPrev;
      next.disabled = !state.canNext;
      input.disabled = state.totalPages <= 1;
      input.value = state.lastPage > state.page ? `${state.page}-${state.lastPage}` : String(state.page);
      total.textContent = String(state.totalPages);
    }
  };
}

export function renderShell(root: HTMLElement, opts: ShellOptions): ShellRefs {
  root.textContent = "";
  const app = el("div", "xl-app");

  const titlebar = el("div", "xl-titlebar");
  const qat = el("div", "xl-qat", "💾  ↶  ↷  ▾");
  const title = el("div", "xl-title", opts.title);
  const account = el("div", "xl-account", "🔍  ⚙");
  const winctl = el("div", "xl-winctl", "—   ▢   ✕");
  titlebar.append(qat, title, account, winctl);

  const tabsBar = el("div", "xl-tabs");
  const panels = el("div", "xl-panels");
  const nav = buildNavGroup((action) => opts.onNav?.(action));
  panels.append(nav.group);
  const fileMenu = el("div", "xl-filemenu");
  fileMenu.hidden = true;
  for (const [cmd, label] of FILE_MENU) {
    const item = el("button", "xl-filemenu-item", label);
    item.dataset.command = cmd;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      fileMenu.hidden = true;
      opts.onFileCommand(cmd);
    });
    fileMenu.append(item);
  }
  for (const [tab, label] of TABS) {
    const button = el("button", tab === "file" ? "xl-tab xl-tab-file" : "xl-tab", label);
    button.dataset.tab = tab;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tab === "file") { fileMenu.hidden = !fileMenu.hidden; return; }
      fileMenu.hidden = true;
      refs.setActiveTab(tab);
      opts.onRibbonTab(tab);
    });
    tabsBar.append(button);
    if (tab !== "file") panels.append(buildPanel(tab));
  }
  tabsBar.append(fileMenu);
  root.ownerDocument.addEventListener("click", () => { fileMenu.hidden = true; });

  const formula = el("div", "xl-formula");
  const nameBox = el("div", "xl-namebox", "A1");
  const fx = el("div", "xl-fx", "ƒx");
  const formulaText = el("div", "xl-formula-text");
  formula.append(nameBox, el("div", "xl-formula-sep", "⋮"), fx, formulaText);

  const body = el("div", "xl-body");
  const sheets = el("div", "xl-sheets");
  const status = el("div", "xl-status");
  const statusText = el("span", "xl-status-text", "就绪");
  status.append(statusText, el("span", "xl-status-right", "▦  ▤  ▣   —  ━━━●━━━  +   100%"));

  app.append(titlebar, tabsBar, panels, formula, body, sheets, status);
  root.append(app);

  const imagesBox = root.querySelector<HTMLInputElement>("#xl-show-images")!;
  imagesBox.addEventListener("change", () => opts.onImagesToggle(imagesBox.checked));

  const refs: ShellRefs = {
    root: app,
    body,
    setTitle(text) { title.textContent = text; },
    setActiveTab(tab) {
      tabsBar.querySelectorAll(".xl-tab").forEach((b) => b.classList.toggle("is-active", (b as HTMLElement).dataset.tab === tab));
      panels.querySelectorAll<HTMLElement>(".xl-panel").forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    },
    setFormula(address, text) { nameBox.textContent = address; formulaText.textContent = text; },
    setStatus(text) { statusText.textContent = text; },
    setSheets(names, active) {
      sheets.textContent = "";
      sheets.append(el("span", "xl-sheet-nav", "◀  ▶"));
      names.forEach((name, index) => {
        const tab = el("button", index === active ? "xl-sheet-tab is-active" : "xl-sheet-tab", name);
        tab.addEventListener("click", () => opts.onSheetSelect(index));
        sheets.append(tab);
      });
      sheets.append(el("span", "xl-sheet-add", "⊕"));
    },
    setImagesChecked(checked) { imagesBox.checked = checked; },
    setNav: nav.set
  };
  refs.setActiveTab("home");
  return refs;
}
