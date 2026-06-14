import { markAll, markElement } from "../mark";
import { trackSelector } from "../selector-tracker";
import type { ContentAdapter } from "../context";

function isUsergroupPage(root: ParentNode): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mod") === "spacecp" && params.get("ac") === "usergroup") return true;

  const title = root.querySelector<HTMLElement>(".mn .bm.bw0 > h1.mt")?.textContent?.trim();
  return title === "用户组" && root.querySelector(".mn .bm.bw0 table.tdat") !== null;
}

export const enhanceSettings: ContentAdapter = (context) => {
  const { root } = context;
  const adapter = "settings";
  // 语义标记表：[选择器, 注入类名, 是否为该路由必需的关键节点]
  // 目的是只对“有意义的表面”加 Liquid Glass，外层 Discuz spacecp 包裹保持透明
  const selectors: Array<[string, string, boolean]> = [
    // 主内容块：spacecp 表单的承载面（如修改头像/个人资料），作为唯一信息卡片（必需）
    [".mn .bm.bw0", "omchh-settings-card", true],
    // 页面主标题（修改头像 / 个人资料 等）：套用 section 标题节奏
    [".mn .bm.bw0 > h1.mt", "omchh-settings-title", false],
    // 表单内分节表格（tfm）：每个 caption 段落作为一个内部分节，而非嵌套卡片
    [".mn form .tfm", "omchh-settings-section", false],
    // 分节标题（当前我的头像 / 设置我的新头像 等）：发光圆点 section 标题
    [".mn form .tfm caption h2", "omchh-settings-section-title", false],
    // 用户组页顶部标签（我的用户组/购买用户组/我的社区权限）
    [".mn .bm.bw0 > ul.tb", "omchh-settings-tabs", false],
    // 用户组页提示条（如还需积分）
    [".mn .bm.bw0 > .tbmu", "omchh-settings-usergroup-note", false],
    // 用户组页权限对照表（Discuz .tdat）：保持原表格语义，只修复布局与表面
    [".mn .bm.bw0 table.tdat", "omchh-settings-usergroup-table", false],
    // 右侧设置导航（设置菜单）：渲染为竖向胶囊导航
    [".appl .tbn", "omchh-side-nav", false],
    // 导航标题（设置）
    [".appl .tbn > h2.mt", "omchh-side-nav-title", false]
  ];
  // 逐条标记并上报命中数量，便于 health 监控选择器是否仍匹配线上 DOM
  selectors.forEach(([selector, className, required]) =>
    trackSelector(adapter, selector, markAll(root, selector, className, adapter), required)
  );
  // 路由级容器：用于将外层包裹整体置透明、约束页面宽度并改双栏布局
  const shell = document.querySelector("#ct");
  markElement(shell, "omchh-settings", adapter);
  if (isUsergroupPage(root)) markElement(shell, "omchh-settings-usergroup", adapter);
};
