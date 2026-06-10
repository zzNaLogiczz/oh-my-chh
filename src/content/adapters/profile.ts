import { markAll, markElement } from "../dom/mark";
import { trackSelector } from "../health";
import type { ContentAdapter } from "./types";

export const enhanceProfile: ContentAdapter = ({ root }) => {
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
