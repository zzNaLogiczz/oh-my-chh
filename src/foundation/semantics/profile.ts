import { markAll, markElement } from "../mark";
import { trackSelector } from "../selector-tracker";
import type { ContentAdapter } from "../context";

// 个人空间工具页（好友列表/我的帖子/访客足迹等）判定：
// 这些页同属 pg_space 路由，但没有身份 hero(#uhd)，而是复用 Discuz ct2_a
// 双栏壳（.mn 主体 + .appl 侧导航），与设置/消息页结构同构。
// 判定依据：无 #uhd，且同时存在 .appl 侧导航与 .mn 主内容列。
// 注意：不同子页 .mn 内部结构不同——好友列表是 .bm.bw0 卡片，帖子列表是
// .mn.pbw + .tl 表格，故这里只认 .mn 这一通用主列，再按内部结构分别标记。
function isSpaceUtilityPage(root: ParentNode): boolean {
  return (
    root.querySelector("#uhd") === null &&
    root.querySelector(".appl .tbn") !== null &&
    root.querySelector(".mn") !== null
  );
}

// 个人空间工具页增强：套用与设置/消息页一致的玻璃壳处理。
// 外层 ct2_a 包裹（含遗留灰色渐变背景）置透明，仅主内容块与侧导航成为玻璃表面。
function enhanceSpaceUtility(root: ParentNode): void {
  const adapter = "profile";
  // 左侧空间导航（好友/帖子/相册 等）与导航标题：两种子页共用竖向胶囊导航组件
  const sharedSelectors: Array<[string, string, boolean]> = [
    [".appl .tbn", "omchh-side-nav", false],
    [".appl .tbn > h2.mt", "omchh-side-nav-title", false]
  ];

  // 主内容承载面：好友列表用 .bm.bw0 卡片；帖子列表无该卡片，退回 .mn 主列自身。
  // 两者都标为 omchh-space-card，成为唯一玻璃表面。
  const card = root.querySelector(".mn .bm.bw0") ?? root.querySelector(".mn");
  markElement(card, "omchh-space-card", adapter);

  if (root.querySelector(".mn .bm.bw0")) {
    // —— 变体 A：好友列表（.bm.bw0 卡片 + h1.mt 标题 + ul.tb 标签）——
    const friendSelectors: Array<[string, string, boolean]> = [
      // 页面主标题（好友列表 等）：发光圆点 section 标题
      [".mn .bm.bw0 > h1.mt", "omchh-space-title", false],
      // 顶部分类标签（全部好友列表/当前在线 等）：胶囊标签
      [".mn .bm.bw0 > ul.tb", "omchh-space-tabs", false]
    ];
    friendSelectors.forEach(([selector, className, required]) =>
      trackSelector(adapter, selector, markAll(root, selector, className, adapter), required)
    );
  } else {
    // —— 变体 B：帖子列表（.mn.pbw + p.tbmu 过滤条 + .tl table 帖子表）——
    const threadSelectors: Array<[string, string, boolean]> = [
      // 顶部过滤/分类条（全部|已发表|… + 选择版块 + 主题|回复|点评 + 搜索）：工具条
      [".mn > p.tbmu", "omchh-space-filter", false],
      // 帖子列表表格：保留原表语义，仅去层叠并重排为可扫描的列表行
      [".mn .tl table", "omchh-space-threads", true],
      // 列表头行（主题/版块圈子/回复查看/最后发帖）：弱化为列标签
      [".mn .tl table tr.th", "omchh-space-threads-head", false]
    ];
    threadSelectors.forEach(([selector, className, required]) =>
      trackSelector(adapter, selector, markAll(root, selector, className, adapter), required)
    );
  }

  sharedSelectors.forEach(([selector, className, required]) =>
    trackSelector(adapter, selector, markAll(root, selector, className, adapter), required)
  );
  // 路由级容器：置外层 ct2_a 包裹透明、约束页面宽度并改双栏栅格布局
  markElement(document.querySelector("#ct"), "omchh-space", adapter);
}

export const enhanceProfile: ContentAdapter = (context) => {
  const { root } = context;
  // 同路由不同结构：空间工具页（无 hero）与身份资料页（有 #uhd）分流处理
  if (isSpaceUtilityPage(root)) {
    enhanceSpaceUtility(root);
    return;
  }

  const adapter = "profile";
  // 语义标记表：[选择器, 注入类名, 是否为该路由必需的关键节点]
  // 目的是只对“有意义的表面”加 Liquid Glass，外层 Discuz 包裹保持透明，避免卡片层叠噪声
  const selectors: Array<[string, string, boolean]> = [
    // 用户身份头部：头像 + 昵称 + 标签页，作为页面 hero 表面（必需）
    ["#uhd", "omchh-profile-header", true],
    ["#uhd .avt", "omchh-profile-avatar", false],
    ["#uhd .h h2", "omchh-profile-name", false],
    ["#uhd .tb", "omchh-profile-tabs", false],
    // 资料主卡：唯一信息表面，内部分节而非嵌套卡片
    [".u_profile", "omchh-profile-card", false],
    // 分节标题（统计信息/用户认证/活跃概况等）：套用发光圆点的 section 标题样式
    [".u_profile h2.mbn", "omchh-profile-section-title", false],
    // 定义型字段行（标签 + 值）：去层叠，靠栅格与节奏区分；排除 #pbbs 避免与下方 -posts 重复标记
    [".u_profile .pf_l:not(#pbbs)", "omchh-profile-fields", false],
    // 好友数/回帖数/主题数等内联统计：渲染为数据胶囊
    [".u_profile ul.bbda", "omchh-profile-stats", false],
    // 活跃概况字段块（在线时间/注册时间/IP 等）
    ["#pbbs", "omchh-profile-posts", false]
  ];
  // 逐条标记并上报命中数量，便于 health 监控选择器是否仍匹配线上 DOM
  selectors.forEach(([selector, className, required]) => trackSelector(adapter, selector, markAll(root, selector, className, adapter), required));
  // 路由级容器：用于将外层包裹整体置为透明并约束页面宽度
  markElement(document.querySelector("#ct"), "omchh-profile", adapter);
};
