// 网格数据模型：把论坛页面与导入工作簿统一成“行 × 列 + 样式 + 合并”，由 renderGrid 画成 Excel 网格
import type { ArticlePage, ForumIndexPage, NavLink, PortalListPage, Post, SearchPage, ThreadDetailPage, ThreadListPage } from "../model";
import type { CellStyle, WbMerge, WbSheet } from "../workbook/model";

/** url：单元格自己的链接（频道导航这类一行多链接），优先于所在行的 url */
export interface GridCell { text: string; formula?: string; style?: CellStyle; comment?: boolean; url?: string }
/** key：楼层 pid / 帖子 tid；url：激活（双击 / Enter）时的导航目标 */
export interface GridRow { cells: Array<GridCell | undefined>; height?: number; key?: string; url?: string }
/** flexColumn：窗口不够宽时收窄的主文本列（标题 / 摘要），其余列宽度不变 */
export interface GridModel {
  columns: { width: number }[]; rows: GridRow[]; merges: WbMerge[]; frozenRows: number; frozenCols: number; flexColumn?: number;
}

export const ROW_HEADER_PX = 40;
const FLEX_MIN_PX = 160;

const TITLE: CellStyle = { bold: true, fontSize: 14 };
const HEAD: CellStyle = { bold: true, fill: "#dde9e1" };
const CATEGORY: CellStyle = { bold: true, fill: "#f2f2f2" };
const NUMBER: CellStyle = { hAlign: "right" };
const PINNED_FILL = "#fff2cc";

export function columnLabel(index: number): string {
  let cursor = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (cursor % 26)) + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);
  return label;
}

export function cellAddress(r: number, c: number): string {
  return `${columnLabel(c)}${r + 1}`;
}

const str = (value: string | null | undefined): GridCell => ({ text: value ?? "" });
const num = (value: number | null | undefined, extra?: CellStyle): GridCell => ({
  text: value === null || value === undefined ? "" : String(value),
  style: { ...NUMBER, ...extra }
});

/**
 * 主文本列宽：让所有数据列刚好放进网格可视宽度（扣掉行号列与 2px 边线）；
 * 只收窄不加宽，最窄 160px；宽度未知（尚未布局）时保持设计宽度。
 */
export function fitFlexColumn(columns: { width: number }[], flexIndex: number, hostWidth: number): number {
  const design = columns[flexIndex]?.width ?? FLEX_MIN_PX;
  if (hostWidth <= 0) return design;
  const others = columns.reduce((sum, column, index) => (index === flexIndex ? sum : sum + column.width), 0);
  return Math.min(design, Math.max(FLEX_MIN_PX, hostWidth - ROW_HEADER_PX - others - 2));
}

const LINK: CellStyle = { color: "#0563c1", underline: true };
const NAV_PER_ROW = 5;
const link = (target: NavLink): GridCell => ({ text: target.name, url: target.url, style: LINK });

/** 报表骨架：第 1 行合并标题、第 2 行表头，二者冻结 */
function frame(title: string, headers: string[], widths: number[], flexColumn?: number) {
  const span = headers.length - 1;
  return {
    columns: widths.map((width) => ({ width })),
    rows: [
      { cells: [{ text: title, style: TITLE }] },
      { cells: headers.map((text) => ({ text, style: HEAD })) }
    ] as GridRow[],
    merges: [{ r1: 0, c1: 0, r2: 0, c2: span }] as WbMerge[],
    frozenRows: 2,
    frozenCols: 0,
    ...(flexColumn === undefined ? {} : { flexColumn })
  };
}

/** 分组小标题：独占一行并跨列合并 */
function sectionRow(grid: GridModel, title: string, lastColumn: number): void {
  grid.merges.push({ r1: grid.rows.length, c1: 0, r2: grid.rows.length, c2: lastColumn });
  grid.rows.push({ cells: [{ text: title, style: CATEGORY }] });
}

export function forumIndexGrid(page: ForumIndexPage): GridModel {
  const grid = frame("版块列表", ["版块", "今日", "主题", "帖子", "最后发表", "最后发表人"], [240, 70, 80, 90, 140, 120]);
  // 频道导航在版块之上：A 列是频道，B–F 列依次是二级分类（每格各自可点）；
  // 每行最多 5 个，多出的折到下一行，导航区不超出表格本身的宽度
  if (page.channels.length) {
    sectionRow(grid, "频道导航", 5);
    for (const channel of page.channels) {
      grid.rows.push({ cells: [link(channel), ...channel.subs.slice(0, NAV_PER_ROW).map(link)] });
      for (let i = NAV_PER_ROW; i < channel.subs.length; i += NAV_PER_ROW) {
        grid.rows.push({ cells: [undefined, ...channel.subs.slice(i, i + NAV_PER_ROW).map(link)] });
      }
    }
  }
  for (const category of page.categories) {
    sectionRow(grid, category.name, 5);
    for (const forum of category.forums) {
      grid.rows.push({
        key: forum.fid,
        url: forum.url,
        cells: [str(forum.name), num(forum.today), num(forum.threads), num(forum.posts), str(forum.lastPostAt), str(forum.lastPostBy)]
      });
    }
  }
  return grid;
}

export function threadListRows(page: ThreadListPage): GridRow[] {
  return page.threads.map((thread) => {
    const fill = thread.pinned ? { fill: PINNED_FILL } : undefined;
    return {
      key: thread.tid,
      url: thread.url,
      cells: [
        { text: thread.title, ...(fill ? { style: fill } : {}) },
        { text: thread.author ?? "", ...(fill ? { style: fill } : {}) },
        { text: thread.createdAt ?? "", ...(fill ? { style: fill } : {}) },
        num(thread.replies, fill), num(thread.views, fill),
        { text: thread.lastPostAt ?? "", ...(fill ? { style: fill } : {}) },
        { text: thread.lastPostBy ?? "", ...(fill ? { style: fill } : {}) }
      ]
    };
  });
}

export function threadListGrid(page: ThreadListPage): GridModel {
  const grid = frame(page.forumName || "帖子列表", ["标题", "作者", "发表时间", "回复", "查看", "最后回复", "回复人"], [400, 110, 130, 60, 70, 130, 110], 0);
  grid.rows.push(...threadListRows(page));
  return grid;
}

/** 摘要：首个文本块前 40 字；纯图楼显示 [图片]，屏蔽楼显示（内容已屏蔽） */
export function postSummary(post: Post): string {
  if (post.locked) return "（内容已屏蔽）";
  const first = post.blocks.find((block) => block.kind === "text" || block.kind === "quote");
  if (first && "text" in first) {
    const flat = first.text.replace(/\s+/g, " ");
    return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat;
  }
  return post.blocks.some((block) => block.kind === "image") ? "[图片]" : "";
}

export function threadDetailRows(posts: Post[]): GridRow[] {
  return posts.map((post) => ({
    key: post.pid,
    cells: [post.label ? { text: post.label, style: NUMBER } : num(post.floor), str(post.author), { text: postSummary(post), comment: true }, str(post.postedAt)]
  }));
}

export function threadDetailGrid(page: ThreadDetailPage): GridModel {
  const grid = frame(page.title || "帖子", ["楼层", "作者", "摘要", "时间"], [56, 120, 320, 130], 2);
  grid.rows.push(...threadDetailRows(page.posts));
  return grid;
}

/** 门户文章与帖子详情同一张表：正文一行 + 每条评论一行，内容在批注窗格 */
export function articleGrid(page: ArticlePage): GridModel {
  const grid = frame(page.title || "文章", ["楼层", "作者", "摘要", "时间"], [56, 120, 320, 130], 2);
  grid.rows.push(...threadDetailRows(page.posts));
  return grid;
}

/** 分类格自带链接：双击分类进入该子分类，双击其他格打开文章 */
export function portalListRows(page: PortalListPage): GridRow[] {
  return page.articles.map((article) => ({
    key: article.aid,
    url: article.url,
    cells: [
      str(article.title),
      article.category && article.categoryUrl ? link({ name: article.category, url: article.categoryUrl }) : str(article.category),
      str(article.postedAt),
      str(article.summary)
    ]
  }));
}

export function portalListGrid(page: PortalListPage): GridModel {
  // 窗口窄时先收窄摘要列（只是正文开头的截断预览），标题保持完整
  const grid = frame(page.name || "文章列表", ["标题", "分类", "发布时间", "摘要"], [360, 90, 130, 420], 3);
  grid.rows.push(...portalListRows(page));
  return grid;
}

export function searchRows(page: SearchPage): GridRow[] {
  return page.results.map((result) => ({
    key: result.tid,
    url: result.url,
    cells: [str(result.title), str(result.forumName), str(result.author), str(result.postedAt), num(result.replies), num(result.views)]
  }));
}

export function searchGrid(page: SearchPage): GridModel {
  const total = page.total === null ? "" : `（共 ${page.total} 条）`;
  const grid = frame(`查找：${page.keyword}${total}`, ["标题", "版块", "作者", "时间", "回复", "查看"], [400, 130, 110, 130, 60, 70], 0);
  grid.rows.push(...searchRows(page));
  return grid;
}

export function workbookGrid(sheet: WbSheet, styles: CellStyle[]): GridModel {
  const rows: GridRow[] = Array.from({ length: sheet.rowCount }, (_, r) => ({ cells: [], height: sheet.rowHeights[r] }));
  for (const cell of sheet.cells) {
    const row = rows[cell.r];
    if (!row) continue;
    row.cells[cell.c] = {
      text: cell.text,
      ...(cell.formula ? { formula: cell.formula } : {}),
      ...(cell.s !== undefined && styles[cell.s] ? { style: styles[cell.s] } : {})
    };
  }
  return {
    columns: sheet.colWidths.map((width) => ({ width })),
    rows,
    merges: sheet.merges,
    frozenRows: sheet.frozenRows,
    frozenCols: sheet.frozenCols
  };
}
