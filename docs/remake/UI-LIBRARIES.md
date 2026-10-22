# UI 组件库标准（remakeweb）

> 状态：已确认（2026-09-20）· 适用范围：remakeweb 重绘全部页面 · 评审记录：Spectrum → 候选库盘点 → 用户确认
>
> 2026-10-22：门户首页 HeroUI 重绘随液态皮肤一并删除，当前代码不再依赖 HeroUI / React；皮肤只剩「原版」与「Excel 伪装」（自绘，见下方例外登记）。本文保留为选型记录。

## 结论

| 定位 | 库 | npm 包（锚定版本） | 官网 |
|---|---|---|---|
| **主组件库** | HeroUI v3 | `@heroui/react@3.2.6` + `@heroui/styles@3.2.6` | https://www.heroui.com/ |
| AI 对话组件 | assistant-ui | `@assistant-ui/react` | https://www.assistant-ui.com/ |
| 动效引擎 | Motion | `motion` | https://motion.dev/ |
| 数字滚动 | NumberFlow | `number-flow` | https://number-flow.barvian.me/ |

选型依据：细腻质感 + 动效丰富 + AI 产品适配 + **可 npm 直接引用**。HeroUI v3 = React 19 + Tailwind v4 + React Aria Components，75+ 组件，官方提供 AGENTS.md / MCP / llms.txt，AI 辅助开发工具链完备。

## 引用规范（硬性）

1. **一律 npm 安装后 `import` 组件**，如 `import { Dropdown, Link, Button } from "@heroui/react"`。
2. **禁止**把库源码拷贝进仓库；**禁止**手写仿制组件（含"令牌模仿"——用自写 CSS 模拟库的效果同样不行）。
3. 样式定制只走库提供的官方通道：`className` / `variant` / CSS 变量 / `data-*` 状态，不改库内部结构。
4. HeroUI 样式接入：`@import "tailwindcss"; @import "@heroui/styles";`（Tailwind v4 管线）。
5. 暗色模式：`<html class="dark">` 或 `[data-theme="dark"]`，两种机制库内双兼容；与现有 `.dark` 开关无缝。
6. 版本锚定 + 锁文件提交；升级需过视觉回归（截图对比）再合入。

## 例外登记

- **Excel 伪装皮肤（2026-10-21）**：整体豁免“引用规范”第 2 条（禁止手写仿制组件）。理由：仿 Excel 窗口本身就是该皮肤的产品功能，HeroUI 无法呈现 Excel 视觉；该皮肤为原生 DOM 实现（`src/remake/excel/app/`），不引入第二套组件库。HeroUI 皮肤仍受原规则约束。

## 应用范围

- **顶栏二级导航**：HeroUI v3 已移除 Navbar 组件——导航壳（sticky/blur 布局）为本项目自有语义化代码，交互组件全部引用库：`Dropdown`（Trigger/Popover/Menu/Item，点开式）、`Link`、`SearchField`、`Button`。
- **AI 对话流**（后续）：assistant-ui。
- **统计数字 / 全局动效**：NumberFlow / Motion。
- **不混用 antd 系**（Ant Design X、Lobe UI 质感好但属第二套设计语言，仅作观察）。
- **shadcn/Spectrum 等 registry 拷贝式生态**（Spectrum、shadcn、Magic UI、Origin UI、Motion Primitives、Kibo UI 等）：不作为运行时依赖来源（它们没有 npm 运行时包，消费即拷贝，违反第 1 条）。

## 预览工程

`.omx/heroui-preview/`（vite + React 19 + Tailwind v4 真实构建）→ 产物 `.omx/spectrum-review/heroui-dist/`。扩展正式集成时以同样方式将 HeroUI 作为 npm 依赖接入构建管线。
