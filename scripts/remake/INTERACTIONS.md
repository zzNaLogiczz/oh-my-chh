# remakeweb：页面交互机制与重绘对接方案

> 逐项探测自登录态真实页面（tid=2192109 + forum-283），记录每类交互在原页面的机制、
> 重绘后如何取数、如何提交。探索过程只做了 GET 探测，未实际提交任何数据。

## 总纲：Discuz 交互的四种模式

| 模式 | 例子 | 重绘策略 |
|---|---|---|
| 整页跳转（读） | 翻页、进帖、切换版块 | 换 URL → 重新解析 → 重绘 |
| formhash GET 链接（轻写） | 收藏、忽略、删除 | fetch 该链接（带 cookie）即完成 |
| 表单 POST（重写） | 快速回帖、发帖 | fetch POST 表单编码，解析响应 |
| showWindow AJAX 弹窗（中间态） | 引用回复、收藏确认 | fetch URL → 解析表单 → 自有 Modal 渲染 |

## 1. 分页

- 帖子列表/详情均为纯 URL 分页：`forum-283-2.html` / `viewthread&tid=X&extra=&page=2`
- 实测 `.pg` 链接完整（label + href），无自动翻页组件（`#autopbn` 不存在）
- **重绘**：换 URL 重新解析；或已知页码直接构造 `&page=N`

## 2. 点击切换（只看作者 / 倒序 / 打印）

全部是 URL 参数切换，实测样本：
- 只看该作者：`viewthread&tid=X&page=1&authorid=2`
- 上一主题/下一主题：`mod=redirect&goto=nextoldset/nextnewset&tid=X`
- 打印版：`viewthread&action=printable&tid=X`
- **重绘**：切换 = 换 URL 参数重新解析，零状态管理

## 3. 下拉菜单

页面预渲染了 **26 个 `div[id$=_menu]` 隐藏层**，数据在 DOM 里：
- `#qmenu_menu`（快捷导航，7 行链接）
- `#visitedforums_menu`（访问过的版块）
- `#aimg_*_menu`（图片操作菜单：找图/关闭）
- `#fastpostsml_menu`（快速回帖表情）
- 特例：`#fjump_menu`（版块跳转）为空壳，由 `showForummenu()` JS 填充
- **重绘**：预渲染层直接从 DOM 提取；JS 填充的（fjump）改为解析 `forum.php` 版块树或调 Discuz 函数

## 4. 长帖折叠

- 实测帖（59 楼）无折叠：`td.t_f` max-height=none、无 folded 类、无展开按钮
- chiphell 默认不折叠长帖 → 重绘层可自实现"超过 N px 收起"，无数据依赖

## 5. 快速回帖（核心写操作）

原页表单 `#fastpostform`：
```
action: forum.php?mod=post&action=reply&fid={fid}&tid={tid}&extra=&replysubmit=yes
        &infloat=yes&handlekey=fastpost
method: POST
字段: message(textarea) / formhash / usesig / subject(可空)
onsubmit: fastpostvalidate(this)（原页 JS 校验）
```
- **重绘提交**：fetch POST `application/x-www-form-urlencoded`（同 action + 字段），
  响应文本含 `succeedhandle_` = 成功；含 `seccode`/`验证码` = 需要验证码（降级到原页）
- formhash 从页面解析时一并提取（每会话固定）
- 注意：部分版块回帖需要**人机验证**（与登录同款腾讯滑块），此类场景重绘层必须能
  检测并降级到原页

## 6. 引用回复弹窗（showWindow 体系）

- 帖内「回复」：`showWindow('reply', forum.php?mod=post&action=reply&fid=X&tid=X&reppost={pid}...)`
- **重绘**：fetch 该 URL（GET，返回完整 HTML）→ DOMParser 提取 `#postform` 及字段
  → 渲染自有 Spectrum Dialog → POST 原 action
- `inajax=1` 参数对该端点未生效（返回整页 HTML），按整页解析处理即可

## 7. 收藏 / 轻写操作

- 收藏链接即操作：`home.php?mod=spacecp&ac=favorite&type=thread&id={tid}&formhash={hash}`
  （GET 携带 cookie + formhash → 服务端直接执行，响应为确认弹窗 HTML）
- **重绘**：fetch 该链接即完成收藏；响应可解析出成功提示
- 同类机制：忽略用户（`op=pm_ignore&username=X&plid=Y`）、删除私信（`op=delete&deletepm_deluid[]=X`）

## 8. 未启用的功能

- 本帖（建议意见版块）无 评分/举报/点评 链接——chiphell 按版块开关这些功能
- 机制同收藏（GET + formhash 或 showWindow），出现时按第 7 节模式处理

## 数据清单（当前会话探测所得）

- formhash：`049dccaf`（页面解析时随帖提取）
- 预渲染菜单层：26 个（含图片菜单 per 图片）
- 快速回帖字段：message / formhash / usesig / subject
