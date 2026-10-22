# Excel 伪装皮肤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 oh-my-chh（`remakeweb` 分支）中实现 Excel 伪装模式：chh 四类页面（版块列表/帖子列表/帖子详情/搜索）以 Excel 窗口呈现，老板键瞬切到用户导入的真实 `.xlsx`，产出可“加载已解压的扩展程序”的本地包。

**Architecture:** content script（`main.js` 内）做宿主：遮住原页、守卫标题/图标、同源抓取并解析 chh 页面、维护历史；全部 Excel UI 是扩展页面 `excel/app.html`，以全屏 iframe 覆盖页面，经 `MessageChannel` 端口接收解析后的论坛数据，自己从 `chrome.storage.local` 读取导入的工作簿。导入在扩展 options 页完成（exceljs + ssf 一次性解析为规范化 JSON）。

**Tech Stack:** TypeScript、Vite 8（现有 `scripts/build-extension.mjs` 管线）、Vitest 4 + jsdom、原生 DOM（Excel UI 不用 React/HeroUI）、`exceljs@4.4.0`、`ssf@0.11.2`。

**Spec:** `docs/superpowers/specs/2026-10-21-excel-skin-design.md`

## Global Constraints

- 只注入 `https://www.chiphell.com/*`；manifest 权限保持仅 `storage`（不加 `unlimitedStorage`）。
- Excel 模式下任何时刻不得显示原站：不调用 `markPaintReady()`，原 `body` 永不可见。
- Excel UI 零外部请求：不加载 Google Fonts/CDN；字体栈 `"Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif`；图片只来自 chh 自身地址。
- 工作簿数据只存 `chrome.storage.local`，只在扩展页面（iframe/options）读取和渲染；content script 永不读取工作簿内容。
- 帖子正文一律 `textContent` / DOM API 写入，不注入原 HTML。
- 标签页图标用通用绿色表格 SVG，不用微软 logo；标题格式 `<显示文件名> - Excel`。
- 论坛相关工作表标签用中性名 `SheetN`，不出现“版块/帖子/搜索”。
- 只读：不发帖、不回帖、不提交任何表单。
- 快捷键默认：老板键 `Alt+Digit1`，图片全局开关 `Alt+Digit2`；按 `KeyboardEvent.code` 匹配（macOS 下 Alt+1 的 `key` 是 `¡`）；IME 组合中（`isComposing`）不触发。
- 工作簿上限：每表 1000 行 × 100 列，序列化后 ≤ 8,000,000 字节，超出截断/拒绝并提示。
- 注释：业务步骤注释用中文（项目既有惯例），标识符英文。
- 不提交 git（本仓库未获用户授权提交）；每个任务以测试通过为完成标志。

## Review Focus

1. **登录过期**：抓取页返回登录提示（`#messagetext` 含“登录”或出现登录表单）→ 应显示 Excel 风格“需要重新登录”提示与「文件 → 在浏览器中打开原网页」，而不是空表或报错堆栈。→ Task 3 `parsePage` 测试 + Task 9 控制器测试。
2. **快速连点导航**：连续双击多行，较早请求晚到 → 只渲染最后一次请求的结果。→ Task 9 `createRequestGate` 测试。
3. **企业表格主题色**：大多数公司模板用主题色 + tint（而非 argb）→ 填充/字色必须解析为正确颜色，不能变成黑色或丢失。→ Task 4 `resolveColor` 测试。
4. **超大工作簿**：5 万行导出表 → 截断到 1000×100 并在状态栏提示，序列化超 8MB 时拒绝导入并给出原因，不崩溃。→ Task 4 测试。
5. **帖子里混入脚本/被屏蔽楼层**：`<script>` 文本不得出现在批注里；`.locked` 楼显示“内容已屏蔽”。→ Task 3 测试（fixture 含 58 楼脚本帖与 `.locked` 楼）。

---

### Task 1: 设置项、Excel 偏好与快捷键匹配

**Files:**
- Modify: `src/shared/preferences-shape.ts`, `src/preferences/schema.ts`
- Create: `src/remake/excel/prefs.ts`, `src/remake/excel/keys.ts`
- Test: `test/unit/preferences-schema.test.ts`（更新）, `test/unit/excel-prefs.test.ts`, `test/unit/excel-keys.test.ts`

**Interfaces:**
- Produces:
  - `OmchhSettingsShape.displayMode: "standard" | "excel"`（sync 存储，默认 `"standard"`），`asDisplayMode(value: unknown): "standard" | "excel"`
  - `interface ExcelPrefs { displayName: string; bossKey: string; imagesKey: string; imagesDefault: "show" | "hide" }`
  - `DEFAULT_EXCEL_PREFS: ExcelPrefs = { displayName: "工作簿1.xlsx", bossKey: "Alt+Digit1", imagesKey: "Alt+Digit2", imagesDefault: "show" }`
  - `EXCEL_PREFS_KEY = "omchhExcel:prefs"`, `EXCEL_WORKBOOK_KEY = "omchhExcel:workbook"`（均在 `chrome.storage.local`）
  - `normalizeExcelPrefs(raw: unknown): ExcelPrefs`、`loadExcelPrefs(): Promise<ExcelPrefs>`、`saveExcelPrefs(prefs: ExcelPrefs): Promise<void>`
  - `excelWindowTitle(prefs: ExcelPrefs): string` → `"<displayName> - Excel"`
  - `interface KeyLike { code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; isComposing?: boolean }`
  - `matchesShortcut(event: KeyLike, spec: string): boolean`、`shortcutFromEvent(event: KeyLike): string | null`、`formatShortcut(spec: string): string`

- [ ] **Step 1: 写失败测试**
  - schema：`DEFAULT_SETTINGS.displayMode === "standard"`，`SETTINGS_KEYS` 末尾追加 `"displayMode"`；`normalizeSettings({ displayMode: "weird" }).displayMode === "standard"`，`"excel"` 保留。
  - prefs：`normalizeExcelPrefs({ displayName: "", bossKey: 1 })` 回落默认；`displayName` 超 120 字符截断；`excelWindowTitle({...DEFAULT_EXCEL_PREFS, displayName: "Q4 对账.xlsx"}) === "Q4 对账.xlsx - Excel"`。
  - keys：`matchesShortcut({code:"Digit1",altKey:true,ctrlKey:false,metaKey:false,shiftKey:false}, "Alt+Digit1") === true`；多一个 Shift → false；`isComposing: true` → false；`shortcutFromEvent` 对单独修饰键（`code: "AltLeft"`）返回 null、对 `Ctrl+Shift+KeyQ` 返回 `"Ctrl+Shift+KeyQ"`（修饰键顺序固定 Ctrl, Alt, Shift, Meta）；`formatShortcut("Alt+Digit1") === "Alt+1"`、`formatShortcut("Ctrl+KeyQ") === "Ctrl+Q"`。
- [ ] **Step 2: 运行** `npx vitest run test/unit/preferences-schema.test.ts test/unit/excel-prefs.test.ts test/unit/excel-keys.test.ts`，预期 FAIL（模块不存在 / 字段缺失）。
- [ ] **Step 3: 实现** 上述签名。`loadExcelPrefs` 无 `chrome.storage` 时返回默认值（与 `src/preferences/settings.ts` 的容错一致）。
- [ ] **Step 4: 运行同一命令**，预期 PASS；再跑 `npm test` 确认既有测试未被 `SETTINGS_KEYS` 变化打破（必要时同步更新断言）。

### Task 2: 测试夹具 + 路由识别 + 版块列表/帖子列表解析

**Files:**
- Create: `scripts/remake/make-excel-fixtures.mjs`, `test/fixtures/excel/*.html`（脚本产物）
- Create: `src/remake/excel/model.ts`, `src/remake/excel/parse/common.ts`, `src/remake/excel/parse/route.ts`, `src/remake/excel/parse/forum-index.ts`, `src/remake/excel/parse/thread-list.ts`
- Test: `test/unit/excel-parse-lists.test.ts`

**Interfaces:**
- Produces（`model.ts`，后续所有任务共用）:
```ts
export type ExcelRoute = "forum-index" | "thread-list" | "thread-detail" | "search" | "portal-home" | "unsupported";
export interface PageInfo { page: number; totalPages: number; nextUrl: string | null }
export interface ForumEntry { fid: string; name: string; url: string; today: number | null; threads: number | null; posts: number | null; lastPostAt: string | null; lastPostTitle: string | null; lastPostBy: string | null }
export interface ForumCategory { id: string; name: string; forums: ForumEntry[] }
export interface ForumIndexPage { kind: "forum-index"; categories: ForumCategory[] }
export interface ThreadRow { tid: string; title: string; url: string; author: string | null; createdAt: string | null; replies: number | null; views: number | null; lastPostAt: string | null; lastPostBy: string | null; pinned: boolean }
export interface ThreadListPage { kind: "thread-list"; fid: string; forumName: string; threads: ThreadRow[]; pageInfo: PageInfo }
export type PostBlock = { kind: "text"; text: string } | { kind: "image"; src: string; name: string } | { kind: "quote"; author: string | null; text: string };
export interface Post { pid: string; floor: number; author: string; avatar: string | null; postedAt: string | null; locked: boolean; blocks: PostBlock[] }
export interface ThreadDetailPage { kind: "thread-detail"; tid: string; title: string; forumName: string | null; views: number | null; replies: number | null; posts: Post[]; pageInfo: PageInfo }
export interface SearchRow { tid: string; title: string; url: string; replies: number | null; views: number | null; snippet: string; postedAt: string | null; author: string | null; forumName: string | null }
export interface SearchPage { kind: "search"; keyword: string; total: number | null; results: SearchRow[]; pageInfo: PageInfo }
export interface NoticePage { kind: "notice"; reason: "login-required" | "unsupported" | "message"; message: string }
export type ExcelPage = ForumIndexPage | ThreadListPage | ThreadDetailPage | SearchPage | NoticePage;
```
  - `detectExcelRoute(url: URL): ExcelRoute`
  - `common.ts`：`text(el: Element | null | undefined): string`（压缩空白）、`exactCount(el: Element | null): number | null`（优先 `span[title]` 的精确值，“1万”这类缩写只在无 title 时解析）、`absUrl(href: string | null, base: string): string | null`、`parsePageInfo(doc: Document, base: string): PageInfo`
  - `parseForumIndex(doc: Document, base: string): ForumIndexPage`、`parseThreadList(doc: Document, base: string): ThreadListPage`

- [ ] **Step 1: 写夹具脚本并生成夹具**。输入 `.omx/excel-recon/{forum-index,thread-list,thread-detail,thread-detail-p2,thread-2904948,search}.raw.html`（已在 2026-10-21 侦察中抓取，gitignore）。处理：删除除 `td.t_f` 内部以外的全部 `<script>`；删除 `#hd`、`#ft`、`#um`、所有 `input[name=formhash]`；全文把登录用户名替换为 `tester`（用户名与 uid 从原始页面识别，脚本里不写账号信息）。输出到 `test/fixtures/excel/`，文件名同输入去掉 `.raw`。运行 `node scripts/remake/make-excel-fixtures.mjs`，确认 6 个文件生成，且脚本的残留检查通过（任何夹具里留着登录身份都会报错退出）。
- [ ] **Step 2: 写失败测试** `excel-parse-lists.test.ts`（用 `new DOMParser().parseFromString(readFileSync(...), "text/html")`）：
  - 路由：`/forum.php`→forum-index；`/forum-283-1.html` 与 `/forum.php?mod=forumdisplay&fid=283`→thread-list；`/thread-2192109-1-1.html` 与 `/forum.php?mod=viewthread&tid=2192109`→thread-detail；`/search.php?mod=forum&searchid=2604&kw=5090`→search；`/` 与 `/portal.php`→portal-home；`/space-uid-2.html`、`/home.php?mod=space&do=pm`→unsupported。
  - 版块列表：分类数 = 5（含“我收藏的版块”），每个分类 ≥ 1 个版块；同时覆盖两种布局——行式（`table.fl_tb tr` 内 `h2 a`、`td.fl_i span[title]`、`td.fl_by`）与格子式（`td.fl_g dl dt a`、`dd em` 的“主题/帖数”）；“原创分享(新)” `fid === "319"`、`today === 329`、`threads === 17878`、`posts === 827876`。
  - 帖子列表：`forumName === "大恶魔的Blog"`、`fid === "283"`；置顶 6 条 `pinned === true` 且排在前；`tid 2260366` 标题“【全坛最穷】其实天涯 的 速通成魔之路”、作者“其实天涯”、`replies 83`、`views 66614`、`lastPostBy "fengpiaosasa"`；`pageInfo` 为 `{ page: 1, totalPages: 2, nextUrl: "https://www.chiphell.com/forum-283-2.html" }`。
- [ ] **Step 3: 运行** `npx vitest run test/unit/excel-parse-lists.test.ts`，预期 FAIL。
- [ ] **Step 4: 实现** 上述解析函数。所有字段缺失返回 null/空数组，不抛错。
- [ ] **Step 5: 运行**同一命令，预期 PASS。

### Task 3: 帖子详情、搜索、提示页解析与统一入口

**Files:**
- Create: `src/remake/excel/parse/thread-detail.ts`, `src/remake/excel/parse/search.ts`, `src/remake/excel/parse/notice.ts`, `src/remake/excel/parse/index.ts`
- Test: `test/unit/excel-parse-detail.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `model.ts`、`common.ts`、`detectExcelRoute`
- Produces: `parseThreadDetail(doc, base): ThreadDetailPage`、`parseSearch(doc, base): SearchPage`、`detectNotice(doc): NoticePage | null`、`parsePage(doc: Document, url: string): ExcelPage`（先 `detectNotice`，再按路由分派；`portal-home`/`unsupported` 返回 `{ kind: "notice", reason: "unsupported", message: "该内容在此模式下不可用" }`）

正文块抽取规则（`td.t_f` 子树顺序遍历）：跳过 `script`/`style`/`.aimg_tip`/`.tip`；`br` 与块级元素（`div`/`p`）边界产生换行；`img[zoomfile]`/`img[file]` → 先冲刷文本，再产出 `{ kind: "image", src: zoomfile ?? file, name }`，`name` 取同一 `ignore_js_op` 内 `.aimg_tip strong` 的文件名，缺失时用 `src` 末段；`img[smilieid]` 或 `src` 含 `static/image/smiley/` → 文本 `[表情]`；`.quote` → `{ kind: "quote", author, text }`（author 取 `blockquote font[color] ` 文本里“ 发表于 ”之前的部分）；`iframe` → 文本 `[视频]`；`i.pstatus` 跳过；连续 3 个以上换行压成 2 个，首尾空白去掉，空文本块丢弃。

- [ ] **Step 1: 写失败测试**
  - `thread-detail.html`：`title === '论坛已支持帖内插入"B站"视频.'`、`views === 208237`、`replies === 212`、`posts.length === 30`；1 楼 `floor 1`、`author "nApoleon"`、`postedAt "2020-3-3 20:19"`（去掉“发表于 ”）、`avatar` 为绝对 URL、图片块 3 个且首个 `src === "https://static.chiphell.com/forum/202003/03/201535pfhqmhsqt1z3sqzj.png"`、`name === "未标题-1.png"`；`pageInfo.totalPages >= 7`。
  - `thread-detail-p2.html`：33 楼 `locked === true` 且 `blocks` 为空；58 楼（作者 `donglia`）所有文本块不含 `document.getElementById`；31 楼文本 “支持支持支持！”。
  - `thread-2904948.html`：1 楼图片块 8 个，首个 `name === "1.jpg"`；存在 `quote` 块，`author === "kezhang78"`、`text` 含 “新西兰king salmon”。
  - `search.html`：`keyword === "5090"`、`total === 500`、`results.length === 48`；首条 `tid "2910633"`、标题 “5090D的Strata推理速度问题”（高亮标签已剥）、`replies 20`、`views 1329`、`author "wolfpan"`、`forumName "电脑讨论(新)"`、`postedAt "2026-10-20 10:10"`；`pageInfo.nextUrl` 含 `page=2`。
  - 提示页：手写 HTML `<div id="messagetext"><p>您需要先登录才能继续本操作</p></div>` → `parsePage` 返回 `reason "login-required"`；其他 `#messagetext` 文本 → `reason "message"` 且 `message` 为原文。
- [ ] **Step 2: 运行** `npx vitest run test/unit/excel-parse-detail.test.ts`，预期 FAIL。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行**，预期 PASS。

### Task 4: 工作簿规范化模型与存储

**Files:**
- Modify: `package.json`（`dependencies` 加 `exceljs@4.4.0`、`ssf@0.11.2`，精确版本），`package-lock.json`
- Create: `src/remake/excel/workbook/model.ts`, `src/remake/excel/workbook/colors.ts`, `src/remake/excel/workbook/normalize.ts`, `src/remake/excel/workbook/store.ts`, `src/types/ssf.d.ts`（若无类型）
- Test: `test/unit/excel-workbook.test.ts`

**Interfaces:**
- Produces:
```ts
export interface CellStyle { fontFamily?: string; fontSize?: number; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; fill?: string; hAlign?: "left" | "center" | "right"; vAlign?: "top" | "middle" | "bottom"; wrap?: boolean; borderTop?: string; borderRight?: string; borderBottom?: string; borderLeft?: string }
export interface WbCell { r: number; c: number; text: string; formula?: string; s?: number }   // r/c 从 0 起；s 为 styles 下标
export interface WbMerge { r1: number; c1: number; r2: number; c2: number }
export interface WbSheet { name: string; rowCount: number; colCount: number; colWidths: number[]; rowHeights: number[]; cells: WbCell[]; merges: WbMerge[]; frozenRows: number; frozenCols: number; truncated: boolean }
export interface WorkbookModel { version: 1; fileName: string; importedAt: string; styles: CellStyle[]; sheets: WbSheet[]; activeSheet: number }
export const MAX_ROWS = 1000, MAX_COLS = 100, MAX_BYTES = 8_000_000;
export class WorkbookTooLargeError extends Error {}
```
  - `colors.ts`：`DEFAULT_THEME_PALETTE: string[]`（Office 2013+ 默认 12 色，顺序 lt1, dk1, lt2, dk2, accent1–6, hlink, folHlink——注意 Excel `theme` 索引 0/1 对应 lt1/dk1 的互换规则：索引 0→`FFFFFF` 背景色、1→`000000` 文本色）、`parseThemePalette(themeXml: string | undefined): string[]`、`applyTint(hex: string, tint: number): string`（HSL 亮度：tint<0 时 `L*(1+tint)`，tint>0 时 `L*(1-tint)+tint`）、`resolveColor(color: { argb?: string; theme?: number; tint?: number; indexed?: number } | undefined, palette: string[]): string | null`（返回 `#rrggbb`；argb 忽略 alpha；indexed 用 Excel 64 色标准表）
  - `normalizeWorkbook(wb: ExcelJS.Workbook, fileName: string): WorkbookModel`（样式去重：相同 `CellStyle` JSON 共用下标；列宽 px = `Math.round(width * 7 + 5)`，缺省 64；行高 px = `Math.round(heightPt * 4 / 3)`，缺省 20；隐藏行列宽/高置 0；公式格 `text` 用缓存结果格式化、`formula` 存 `"=" + formula`；数字/日期按 `numFmt` 用 `ssf.format` 格式化，失败回落 `String(value)`；富文本取拼接纯文本；超出 MAX_ROWS/MAX_COLS 截断并置 `truncated`）
  - `serializeWorkbook(model: WorkbookModel): string`（JSON.stringify，超 `MAX_BYTES` 抛 `WorkbookTooLargeError`）
  - `store.ts`：`saveWorkbook(model: WorkbookModel): Promise<void>`、`loadWorkbook(): Promise<WorkbookModel | null>`（版本不符返回 null）、`deleteWorkbook(): Promise<void>`，键 `EXCEL_WORKBOOK_KEY`

- [ ] **Step 1: 安装依赖** `npm install exceljs@4.4.0 ssf@0.11.2 --save-exact`，确认 `package.json` 版本精确。
- [ ] **Step 2: 写失败测试**（测试内用 `new ExcelJS.Workbook()` 构造 → `writeBuffer()` → 再 `load()`，保证走真实解析路径）：
  - 合并 `A1:C1` → `merges` 含 `{ r1: 0, c1: 0, r2: 0, c2: 2 }`；
  - `B2 = 1234.5`、`numFmt "#,##0.00"` → `text "1,234.50"`；日期 `2026-10-21`、`numFmt "yyyy/mm/dd"` → `"2026/10/21"`；
  - 公式 `C3 = { formula: "SUM(A3:B3)", result: 30 }` → `text "30"`、`formula "=SUM(A3:B3)"`；
  - 填充 `{ argb: "FFFFC000" }` → `fill "#ffc000"`；`resolveColor({ theme: 4, tint: 0.3999 }, DEFAULT_THEME_PALETTE)` 与期望值 `#8eaadb`（accent1 `#4472c4` 提亮 40%）每通道差 ≤ 2；`resolveColor({ theme: 1 }, …) === "#000000"`；
  - 字体粗体红字 → `bold true`、`color "#ff0000"`；两个样式相同的格子 `s` 相同；
  - 列宽 `width 20` → `colWidths[0] === 145`；行高 30pt → 40px；
  - 1200 行 × 5 列 → `rowCount 1000`、`truncated true`；
  - `serializeWorkbook` 对超 `MAX_BYTES` 的模型抛 `WorkbookTooLargeError`。
- [ ] **Step 3: 运行** `npx vitest run test/unit/excel-workbook.test.ts`，预期 FAIL。
- [ ] **Step 4: 实现**。exceljs 的主题 XML 位于 `wb.model.themes?.theme1`（或 `wb._themes.theme1`，实现时以实际对象为准，测试覆盖默认调色板回落）。
- [ ] **Step 5: 运行**，预期 PASS。

### Task 5: 导入与设置页（options 页）

**Files:**
- Create: `src/remake/excel/options/options.html`, `src/remake/excel/options/options.ts`, `src/remake/excel/options/options.css`
- Modify: `scripts/build-extension.mjs`（新增 options 入口构建 + 复制 html/css 到 `dist/excel/`），`manifest.json`（`"options_ui": { "page": "excel/options.html", "open_in_tab": true }`）
- Test: `test/unit/excel-options.test.ts`

**Interfaces:**
- Consumes: Task 1 `loadExcelPrefs/saveExcelPrefs/shortcutFromEvent/formatShortcut`，Task 4 `normalizeWorkbook/serializeWorkbook/saveWorkbook/loadWorkbook/deleteWorkbook`
- Produces: `mountOptionsPage(root: HTMLElement, deps?: { readFile?: (file: File) => Promise<ArrayBuffer> }): Promise<void>`；DOM 契约（供测试与后续说明）：`#excel-file`（`input[type=file][accept=".xlsx"]`）、`#display-name`、`#boss-key`、`#images-key`（只读输入框，聚焦后按键录入）、`#images-default`（select：show/hide）、`#delete-workbook`、`#status`

页面内容：标题“Excel 伪装模式设置”；当前已导入文件名/表数/导入时间；导入按钮；“显示文件名”输入框（导入成功后自动填入真实文件名）及提示文案“标签页标题会对 chh 网页可见，如文件名敏感可改为其他名字”；两个快捷键录入；图片默认；删除按钮；隐私说明一句“工作簿只保存在本机浏览器扩展存储中，不上传、不同步”。

- [ ] **Step 1: 写失败测试**（jsdom，`globalThis.chrome` 用内存 storage stub）：导入一个测试生成的 xlsx（`readFile` 依赖注入）后 `chrome.storage.local` 存有 `EXCEL_WORKBOOK_KEY` 且 `#display-name` 值为该文件名；在 `#boss-key` 上派发 `keydown {code:"KeyQ", ctrlKey:true}` 后 prefs.bossKey === `"Ctrl+KeyQ"`，输入框显示 `"Ctrl+Q"`；点击 `#delete-workbook` 后存储键被移除；导入 `serializeWorkbook` 抛 `WorkbookTooLargeError` 的文件时 `#status` 文本含“文件过大”。
- [ ] **Step 2: 运行** `npx vitest run test/unit/excel-options.test.ts`，预期 FAIL。
- [ ] **Step 3: 实现** 页面与构建入口（Vite `format: "es"`，`entryFileNames: "excel/options.js"`；exceljs 用浏览器包 `exceljs/dist/exceljs.min.js` 以避开 Node polyfill）。
- [ ] **Step 4: 运行**测试 PASS；`npm run build` 后 `ls dist/excel/options.html dist/excel/options.js` 均存在。

### Task 6: Excel 外壳与通用网格

**Files:**
- Create: `src/remake/excel/app/grid-model.ts`, `src/remake/excel/app/grid.ts`, `src/remake/excel/app/shell.ts`, `src/remake/excel/app/views.ts`, `src/remake/excel/app/app.css`, `src/remake/excel/app/icons.ts`
- Test: `test/unit/excel-grid.test.ts`

**Interfaces:**
- Consumes: Task 2/3 `ExcelPage` 各类型，Task 4 `WbSheet/CellStyle`
- Produces:
```ts
export interface GridCell { text: string; formula?: string; style?: CellStyle; comment?: boolean }
export interface GridRow { cells: GridCell[]; height?: number; key?: string; url?: string }   // key: pid/tid，url: 激活时导航目标
export interface GridModel { columns: { width: number }[]; rows: GridRow[]; merges: WbMerge[]; frozenRows: number; frozenCols: number }
export function columnLabel(index: number): string;           // 0→A, 25→Z, 26→AA
export function cellAddress(r: number, c: number): string;    // (0,0)→"A1"
export function forumIndexGrid(page: ForumIndexPage): GridModel;
export function threadListGrid(page: ThreadListPage): GridModel;
export function threadDetailGrid(page: ThreadDetailPage): GridModel;
export function searchGrid(page: SearchPage): GridModel;
export function workbookGrid(sheet: WbSheet, styles: CellStyle[]): GridModel;
export interface GridHandlers { onSelect(r: number, c: number, cell: GridCell | null): void; onActivate(row: GridRow): void; onNearEnd(): void }
export interface GridHandle { appendRows(rows: GridRow[]): void; select(r: number, c: number): void; destroy(): void }
export function renderGrid(host: HTMLElement, model: GridModel, handlers: GridHandlers): GridHandle;
export interface ShellOptions { title: string; onRibbonTab(tab: RibbonTab): void; onFileCommand(cmd: FileCommand): void; onImagesToggle(checked: boolean): void; onSheetSelect(index: number): void }
export type RibbonTab = "file" | "home" | "insert" | "layout" | "formulas" | "data" | "review" | "view";
export type FileCommand = "open-original" | "forum-index" | "import";
export interface ShellRefs { body: HTMLElement; setTitle(t: string): void; setActiveTab(tab: RibbonTab): void; setFormula(address: string, text: string): void; setStatus(text: string): void; setSheets(names: string[], active: number): void; setImagesChecked(v: boolean): void }
export function renderShell(root: HTMLElement, opts: ShellOptions): ShellRefs;
```

视图列定义（第 1 行为标题行：跨全部列合并、加粗 14px；第 2 行为表头：浅绿填充 `#dde9e1`、加粗）：
- 版块列表：`版块 | 今日 | 主题 | 帖子 | 最后发表 | 最后发表人`；每个分类先一行分类名（跨列合并、加粗、浅灰填充 `#f2f2f2`），再逐版块一行（`url` 为版块地址）。
- 帖子列表：`标题 | 作者 | 发表时间 | 回复 | 查看 | 最后回复 | 回复人`；置顶行填充 `#fff2cc`。
- 帖子详情：`楼层 | 作者 | 摘要 | 时间`；摘要取首个文本块前 40 字（无文本时为 `[图片]`/`（内容已屏蔽）`），该格 `comment: true`；`key = pid`。
- 搜索：`标题 | 版块 | 作者 | 时间 | 回复 | 查看`。
- 数字列右对齐。

网格行为：单击选格（绿色 2px 选框）；方向键移动；`Enter`/双击 → `onActivate(row)`（仅 `row.url` 或 `row.key` 存在时）；滚动距底 < 300px → `onNearEnd()`（每次 `appendRows` 后才可再次触发）；选格变化 → `onSelect`。行列头固定显示（列头 sticky top，行号 sticky left），冻结窗格按 `frozenRows/frozenCols` 用 sticky 实现。外壳：标题栏（绿色 `#217346`）、功能区（各选项卡下为装饰性命令组，「视图」组含“显示图片”复选框）、名称框 + `fx` + 编辑栏、`body`、工作表标签栏、状态栏（右侧“就绪”与 100% 缩放装饰）。「文件」打开下拉菜单含三项：“在浏览器中打开原网页”“返回版块列表”“导入工作簿…”。

- [ ] **Step 1: 写失败测试**：`columnLabel(0/25/26/27) === "A"/"Z"/"AA"/"AB"`；`cellAddress(1, 2) === "C2"`；用 Task 2/3 的夹具解析结果断言各 `*Grid` 的列数、首两行内容、版块列表首个分类行跨列合并、帖子列表置顶行填充色、详情行 `comment === true`；`workbookGrid` 保留 merges 与样式下标映射；`renderGrid` 渲染后点击第 3 行第 1 格触发 `onSelect(2, 0, …)`，在其上按 `Enter` 触发 `onActivate`，标题行上按 Enter 不触发；`renderShell` 后 `setSheets(["对账明细", "Sheet2"], 1)` 渲染两个标签且第二个为激活态，`setTitle("Q4.xlsx - Excel")` 更新标题栏。
- [ ] **Step 2: 运行** `npx vitest run test/unit/excel-grid.test.ts`，预期 FAIL。
- [ ] **Step 3: 实现**（原生 DOM；全部文本用 `textContent`；样式类名前缀 `xl-`）。
- [ ] **Step 4: 运行**，预期 PASS。

### Task 7: 批注窗格、图片开关与查找框

**Files:**
- Create: `src/remake/excel/app/comments.ts`, `src/remake/excel/app/image-visibility.ts`, `src/remake/excel/app/find-dialog.ts`
- Test: `test/unit/excel-comments.test.ts`

**Interfaces:**
- Consumes: Task 2 `Post/ThreadDetailPage`，Task 6 外壳
- Produces:
  - `createImageVisibility(initial: "show" | "hide"): ImageVisibility`，`interface ImageVisibility { readonly globalDefault: "show" | "hide"; isVisible(pid: string): boolean; toggle(pid: string): void; setGlobal(v: "show" | "hide"): void }`（`setGlobal` 清空所有单条覆盖）
  - `renderCommentsPane(host: HTMLElement, posts: Post[], vis: ImageVisibility, handlers: { onCardSelect(pid: string): void }): CommentsHandle`，`interface CommentsHandle { appendPosts(posts: Post[]): void; focusPost(pid: string): void; refreshImages(): void; destroy(): void }`
  - `openFindDialog(host: HTMLElement, onSubmit: (keyword: string) => void): () => void`（返回关闭函数）；`searchUrl(keyword: string): string` → `https://www.chiphell.com/search.php?mod=forum&srchtxt=<encodeURIComponent>&searchsubmit=yes`

批注卡片：头像（加载失败回落为作者首字圆形）、作者（加粗）、时间（右对齐灰色）、正文块（文本按 `\n` 分段 `<p>`；引用块为左侧灰线缩进，首行“作者 发表于”灰字；被屏蔽楼显示灰字“（内容已屏蔽）”）；图片可见时为缩略图（`max-height: 140px`，`loading="lazy"`，`referrerpolicy="no-referrer"`，点击在卡片内切换为全宽）；不可见时为文件名标签 `🖼 name`。右上角 `···` 菜单一项：“显示图片”/“隐藏图片”（按当前状态）。`focusPost` 滚动到卡片并加选中描边。查找框：Excel 风格“查找和替换”小窗（“查找内容”输入框、“查找全部”按钮、“关闭”按钮），回车或按钮提交，Esc 关闭。

- [ ] **Step 1: 写失败测试**：`createImageVisibility("show")` → `isVisible("1") === true`；`toggle("1")` 后为 false，其他 pid 仍 true；`setGlobal("hide")` 后 `isVisible("1") === false` 且再 `toggle("1")` → true；用 `thread-2904948.html` 解析结果渲染窗格：1 楼卡片内 `img` 数 = 8，`setGlobal("hide") + refreshImages()` 后 `img` 数 = 0 且出现 8 个文件名标签、首个文本含 `1.jpg`；点击卡片的 `···` → “显示图片”后该卡片恢复 8 张图；33 楼（p2 夹具）显示“（内容已屏蔽）”；全部卡片 `textContent` 不含 `<`；`searchUrl("5090 显卡")` 编码正确；查找框回车调用 `onSubmit("5090")`。
- [ ] **Step 2: 运行** `npx vitest run test/unit/excel-comments.test.ts`，预期 FAIL。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行**，预期 PASS。

### Task 8: iframe 应用主程序与通信协议

**Files:**
- Create: `src/remake/excel/protocol.ts`, `src/remake/excel/app/app.ts`, `src/remake/excel/app/main.ts`, `src/remake/excel/app/app.html`
- Modify: `scripts/build-extension.mjs`（构建 `excel/app.js`，复制 `app.html`、`app.css`），`manifest.json`（`web_accessible_resources` 新增 `{ "resources": ["excel/app.html", "excel/app.js", "excel/app.css"], "matches": ["https://www.chiphell.com/*"] }`）
- Test: `test/unit/excel-app.test.ts`

**Interfaces:**
- Produces（`protocol.ts`，Task 9 共用）:
```ts
export const APP_CONNECT = "omchh-excel:connect";
export type HotkeyAction = "boss" | "images";
export type HostToApp =
  | { type: "loading"; requestId: number; url: string }
  | { type: "page"; requestId: number; url: string; page: ExcelPage; append: boolean }
  | { type: "error"; requestId: number; url: string; message: string }
  | { type: "hotkey"; action: HotkeyAction };
export type AppToHost =
  | { type: "ready" }
  | { type: "navigate"; url: string; append: boolean }
  | { type: "open-original"; url: string };
```
  - `createExcelApp(root: HTMLElement, deps: { port: MessagePort; prefs: ExcelPrefs; workbook: WorkbookModel | null; openOptions(): void }): ExcelAppHandle`，`interface ExcelAppHandle { readonly mode: "workbook" | "forum"; toggleBoss(): void; destroy(): void }`

应用行为：
- 工作表标签 = 导入工作簿各表名（未导入时一个 `Sheet1` 空表）+ 一个论坛表，名为第一个未被占用的 `SheetN`（N 从 2 起）。
- 启动时 `mode === "workbook"`（规格 4.6），除非 `sessionStorage["omchh-excel-forum"] === "1"`（本标签已进入过论坛视图）；切到论坛表时写入该标记。
- 老板键（`prefs.bossKey`，iframe 内 keydown 或收到 `hotkey: boss`）：在“上一次所在的工作簿表”与论坛表之间切换，切换只改可见性，论坛视图 DOM 与滚动位置保留。
- 图片键或「视图 → 显示图片」：调用 `ImageVisibility.setGlobal` 并把新默认写回 `saveExcelPrefs`。
- 论坛表内：按 `page.kind` 选 Task 6 的 grid 构建器；`thread-detail` 时 body 左右分栏（网格 + 360px 批注窗格），功能区激活「审阅」，选行 ↔ `focusPost`、点卡片 ↔ `grid.select`；其他视图激活「开始」。
- 激活行 → `port.postMessage({ type: "navigate", url: row.url, append: false })`；`onNearEnd` 且 `pageInfo.nextUrl` 存在 → `navigate` with `append: true`；收到 `append: true` 的 page 时 `appendRows`/`appendPosts`。
- `loading` → 状态栏“正在计算...”，不清空现有内容；`error` → 状态栏显示错误文字并弹出 Excel 风格对话框（标题 “Microsoft Excel” 不可用，用 “提示”）；`notice` 页 → 空表 + 状态栏文案，`login-required` 文案“需要重新登录：文件 → 在浏览器中打开原网页”。
- `Ctrl+F`（iframe 内）→ 查找框 → `navigate(searchUrl(keyword))`。
- 「文件」命令：`open-original` → `port.postMessage({ type: "open-original", url: 当前页 url })`；`forum-index` → `navigate("https://www.chiphell.com/forum.php")`；`import` → `deps.openOptions()`。
- 编辑栏显示选中格 `formula ?? text`；名称框显示 `cellAddress`。
- 工作簿表可单击/方向键选格；在工作簿表上直接输入字符进入单元格编辑，Enter 提交到内存（不保存），Esc 取消。
- `main.ts`：监听 `window` 的 `message`，仅接受 `event.data === APP_CONNECT` 且带 1 个端口的**第一条**消息；随后 `loadExcelPrefs()` + `loadWorkbook()` → `createExcelApp` → `port.postMessage({ type: "ready" })`；`openOptions` 为 `chrome.runtime.openOptionsPage()`。

- [ ] **Step 1: 写失败测试**（jsdom；`new MessageChannel()` 两端，测试持有 host 端）：创建 app（workbook 含两表“对账明细”“汇总”）→ 标签为 `["对账明细", "汇总", "Sheet2"]`、初始可见为工作簿；host 端发 `page`（forum-index 解析结果）后派发 `keydown {code:"Digit1", altKey:true}` → `mode === "forum"` 且 `sessionStorage["omchh-excel-forum"] === "1"`，再按一次回到 `"workbook"` 且显示的仍是“对账明细”；导入表名含 “Sheet2” 时论坛表名为 “Sheet3”；在论坛网格激活一行 → host 端收到 `{ type: "navigate", url: <版块 url>, append: false }`；发送 `thread-detail` page 后 body 内存在批注窗格且「审阅」激活；发送 `notice/login-required` → 状态栏含“需要重新登录”；`Ctrl+F` 输入 “5090” 回车 → host 收到 search URL 的 `navigate`。
- [ ] **Step 2: 运行** `npx vitest run test/unit/excel-app.test.ts`，预期 FAIL。
- [ ] **Step 3: 实现** `protocol.ts`、`app.ts`、`main.ts`、`app.html`（`<link rel="stylesheet" href="app.css">` + `<script type="module" src="app.js">`，`<meta charset="utf-8">`，`<title>Excel</title>`）与构建入口。
- [ ] **Step 4: 运行**测试 PASS；`npm run build` 后 `dist/excel/app.html|app.js|app.css` 存在。

### Task 9: content script 宿主与启动接入

**Files:**
- Create: `src/remake/excel/host/cover.ts`, `src/remake/excel/host/frame.ts`, `src/remake/excel/host/fetch-page.ts`, `src/remake/excel/host/controller.ts`, `src/remake/excel/host/bypass.ts`
- Modify: `src/platform/bootstrap.ts:332-440`（initialize 内分流），`src/remake/home/standalone.tsx:16`（`activate()` 开头读取 `displayMode`，Excel 模式直接返回）
- Test: `test/unit/excel-host.test.ts`

**Interfaces:**
- Consumes: Task 1 `loadExcelPrefs/excelWindowTitle/matchesShortcut`，Task 3 `parsePage/detectExcelRoute`，Task 8 `protocol.ts`
- Produces:
  - `EXCEL_FAVICON: string`（`data:image/svg+xml,` 通用绿色表格图标）
  - `coverPage(doc: Document): void`（`html[data-omchh-excel="1"]`；注入 `<style id="omchh-excel-cover">`：`html{overflow:hidden!important;background:#fff!important}`、`html[data-omchh-excel] body{display:none!important}`，以及一个纯 CSS 的占位骨架 `#omchh-excel-skeleton`：顶部 32px `#217346` 条 + 网格线背景，iframe 就绪后移除）
  - `guardTitle(doc: Document, title: string): () => void`、`guardFavicon(doc: Document): () => void`（MutationObserver 监听 `documentElement` 子树：`<title>` 文本被改回或新增 `link[rel~=icon]` 时立即纠正/移除）
  - `mountAppFrame(doc: Document, appUrl: string): { frame: HTMLIFrameElement; port: Promise<MessagePort> }`（iframe `position:fixed; inset:0; width:100vw; height:100vh; border:0; z-index:2147483647`，挂在 `documentElement` 下；`load` 后 `frame.contentWindow.postMessage(APP_CONNECT, new URL(appUrl).origin, [channel.port2])`）
  - `fetchExcelPage(url: string): Promise<ExcelPage>`（仅允许 `https://www.chiphell.com` 源，否则拒绝；`fetch(url, { credentials: "include" })`，`DOMParser` 解析后 `parsePage(doc, response.url)`）
  - `createRequestGate(): { begin(): number; isLatest(id: number): boolean }`
  - `consumeExcelBypass(href: string): boolean`、`setExcelBypass(href: string): void`（`sessionStorage` 键 `omchh-excel-bypass`，只对完全相同的 href 生效一次）
  - `startExcelHost(win: Window): Promise<void>`

控制器流程（`startExcelHost`）：① `coverPage` + 立即 `guardTitle(excelWindowTitle(prefs))` + `guardFavicon`；② `mountAppFrame(chrome.runtime.getURL("excel/app.html"))`；③ 端口就绪且收到 `ready` 后，按当前路由取初始数据：`portal-home` → `fetchExcelPage("https://www.chiphell.com/forum.php")`；其他路由在 `DOMContentLoaded` 后直接 `parsePage(document, location.href)`（省一次请求）；④ 收到 `navigate`：`gate.begin()` → 发 `loading` → `fetchExcelPage` → 若仍是最新请求则发 `page`，`append: false` 时 `history.pushState({ omchhExcel: 1 }, "", page 的最终 url)`；失败发 `error`（网络错误文案“无法连接到数据源，请检查网络后重试。”）；⑤ `popstate` → 以 `location.href` 重新取数（`append: false`，不 push）；⑥ `open-original` → `setExcelBypass(url)` 后 `location.href = url`；⑦ 页面层 `keydown`（capture）匹配老板键/图片键时 `preventDefault` 并转发 `hotkey`，随后 `frame.focus()`。

bootstrap 接入：`initialize()` 中 `currentSettings = await loadSettings()` 之后，若 `currentSettings.displayMode === "excel" && !consumeExcelBypass(location.href)`：调用 `startExcelHost(window)`、注册 `onSettingsChanged(s => s.displayMode !== "excel" && location.reload())`，然后 `return`（不加载主题、不 `markPaintReady`、不启动观察器/岛）。原有 `onSettingsChanged` 回调开头加：`displayMode` 变为 `"excel"` 时 `location.reload()`。

- [ ] **Step 1: 写失败测试**：`coverPage` 后 `documentElement.dataset.omchhExcel === "1"` 且样式含 `display:none`；`guardTitle(doc, "Q4.xlsx - Excel")` 后把 `<title>` 改成 “社区 - Chiphell” → 微任务后恢复为 “Q4.xlsx - Excel”；`guardFavicon` 后追加 `<link rel="shortcut icon" href="/favicon.ico">` → 被移除，且存在 `href` 以 `data:image/svg+xml` 开头的 icon；`fetchExcelPage("https://evil.example/x")` 拒绝；`createRequestGate`：`a=begin(); b=begin(); isLatest(a)===false; isLatest(b)===true`；`consumeExcelBypass` 对同一 href 首次 true、第二次 false、不同 href false；控制器用假端口 + `fetch` stub：收到 `navigate`(append false) 后依次发出 `loading`、`page`，且 `history.state.omchhExcel === 1`；两次快速 `navigate`、第一次的 `fetch` 晚返回 → 只发出第二次的 `page`；`fetch` 返回 `#messagetext` 登录提示 → 发出 `page.kind === "notice"`、`reason === "login-required"`；bootstrap 在 `displayMode: "excel"` 设置下不设置 `data-omchh-paint-ready`（参照 `test/unit/first-paint.test.ts` 的写法）。
- [ ] **Step 2: 运行** `npx vitest run test/unit/excel-host.test.ts test/unit/first-paint.test.ts test/unit/bootstrap-refresh.test.ts`，预期新测试 FAIL、既有测试仍 PASS。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 运行**同一命令，预期全部 PASS。

### Task 10: popup 入口、文档、构建门禁与打包

**Files:**
- Modify: `src/preferences/popup/popup-app.tsx`（新增“办公伪装”区块：`Switch`“Excel 伪装模式” ↔ `displayMode`；按钮“导入工作簿 / 快捷键设置”→ `chrome.runtime.openOptionsPage()`；说明一句“开启后打开 chh 直接显示为 Excel，按 Alt+1 切换到你导入的工作簿”），`src/preferences/popup/popup-model.ts`（`saveSettings` 覆盖 `displayMode`）
- Modify: `PRIVACY.md`（新增“Excel 伪装模式”一节：导入的工作簿仅存本机 `chrome.storage.local`、不上传不同步、可在设置页删除；标签页标题使用用户设定的显示文件名，对网页可见）、`docs/remake/UI-LIBRARIES.md`（登记“Excel 皮肤整体豁免第 2 条，理由：仿 Excel 即产品本身”）
- Modify: `test/unit/build-output.test.ts`、`scripts/check-dist-output.mjs`（`requiredPaths` 加 `dist/excel/app.html`、`dist/excel/app.js`、`dist/excel/app.css`、`dist/excel/options.html`、`dist/excel/options.js`；预算：`excel/app.js ≤ 200_000`、`excel/options.js ≤ 1_600_000`、`content/main.js` 维持 `≤ 800_000`）
- Test: `test/unit/popup-controls.test.ts`（追加）

- [ ] **Step 1: 写失败测试**：popup 渲染后存在“Excel 伪装模式”开关，切换后 `chrome.storage.sync` 中 `displayMode === "excel"`；点击“导入工作簿 / 快捷键设置”调用 `chrome.runtime.openOptionsPage`；build-output 新路径与预算断言。
- [ ] **Step 2: 运行** `npx vitest run test/unit/popup-controls.test.ts test/unit/build-output.test.ts`，预期 FAIL。
- [ ] **Step 3: 实现** popup 区块、文档与门禁更新。
- [ ] **Step 4: 运行全量门禁** `npm run verify`，预期 EXIT 0（lint:css → lint:imports → typecheck → unused → test → build → lint:dist → equivalence）。若 equivalence 因环境（需本地 Chrome）失败，记录原文输出，单独跑其余步骤确认全绿。
- [ ] **Step 5: 视觉自检**：本地静态服务 `dist/`，写一个临时宿主页（scratchpad，不入库）创建 iframe 指向 `excel/app.html`、注入 `chrome.storage` 内存 stub（含一份测试工作簿）并经 `MessageChannel` 依次发送 forum-index / thread-list / thread-detail（`thread-2904948` 夹具）/ search 页面数据；用 ego-browser 截图四个视图 + 老板键切换后的工作簿视图 + 无图模式，逐张查看：无 chh 样式、无 React/HeroUI 痕迹、中文不乱码、图片缩略图正常。
- [ ] **Step 6: 打包** `cd dist && zip -qr ../oh-my-chh-excel-dev.zip . && cd ..`；交付 `dist/`（Chrome「加载已解压的扩展程序」选该目录）与 zip 路径，附手测清单：开启模式后打开 `https://www.chiphell.com/`（应直接是 Excel、无闪烁）→ 选项页导入一份真实 xlsx → `Alt+1` 往返 → 版块 → 帖子列表滚动加载 → 帖子详情批注/图片开关/`Alt+2` → `Ctrl+F` 搜索 → 「文件 → 在浏览器中打开原网页」→ 浏览器后退/刷新。
