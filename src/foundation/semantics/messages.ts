import { markAll, markElement } from "../mark";
import { trackSelector } from "../selector-tracker";
import type { ContentAdapter } from "../context";

export const enhanceMessages: ContentAdapter = (context) => {
  const { root } = context;
  const adapter = "messages";
  // 语义标记表：[选择器, 注入类名, 是否为该路由必需的关键节点]
  // 私人/公共消息列表：外层 spacecp 包裹透明，仅会话行成为可扫描的玻璃表面
  const selectors: Array<[string, string, boolean]> = [
    // 主内容块：消息列表的承载面（必需）
    [".mn .bm.bw0", "omchh-messages-card", true],
    // 页面主标题（消息）
    [".mn .bm.bw0 > h1.mt", "omchh-messages-title", false],
    // 顶部分类标签（短消息设置/私人消息/公共消息/发送消息）：渲染为胶囊标签
    [".mn .bm.bw0 > ul.tb", "omchh-messages-tabs", false],
    // 会话列表容器：去掉默认边框背景，仅靠节奏分隔
    [".mn .pml", "omchh-messages-list", false],
    // 单条会话行（一个对话摘要）：作为去层叠的列表行
    [".mn .pml > dl[id^='pmlist_']", "omchh-messages-row", false],
    // 头像列
    [".mn .pml > dl[id^='pmlist_'] > dd.avt", "omchh-messages-avatar", false],
    // 正文列（发件人/收件人 + 摘要 + 时间 + 操作）
    [".mn .pml > dl[id^='pmlist_'] > dd.pm_c", "omchh-messages-body", false],
    // 行内操作区（菜单/回复/计数）
    [".mn .pml .pm_o", "omchh-messages-actions", false],
    // 底部批量操作条（全选/删除/标记已读）
    [".mn form .pgs.pm_op", "omchh-messages-toolbar", false],
    // 右侧通知导航：与设置页共用竖向胶囊导航
    [".appl .tbn", "omchh-side-nav", false],
    // 导航标题（通知）
    [".appl .tbn > h2.mt", "omchh-side-nav-title", false]
  ];
  // 逐条标记并上报命中数量，便于 health 监控选择器是否仍匹配线上 DOM
  selectors.forEach(([selector, className, required]) =>
    trackSelector(adapter, selector, markAll(root, selector, className, adapter), required)
  );
  // 路由级容器：用于将外层包裹整体置透明、约束页面宽度并改双栏布局
  markElement(document.querySelector("#ct"), "omchh-messages", adapter);
};
