# remakeweb：页面解析规则与数据提取

> 目标：验证"解析页面 → 结构化数据 → Spectrum 全面重绘"架构的可行性。
> 本目录是解析规则的**单一事实来源**；提取的数据样本在 `.omx/remake-data/`（含个人信息，不入库）。

## 用法

```bash
# 前置：Chrome 已在 9939 端口运行且已登录 chiphell
node scripts/remake/extract.mjs <route>      # 单个路由
node scripts/remake/extract.mjs all          # 全部路由
node scripts/remake/extract.mjs thread-detail "https://www.chiphell.com/thread-XXX-1-1.html"
```

## 路由与解析规则

### portal-home（门户首页 `/`）
| 数据 | 来源 | 说明 |
|---|---|---|
| news[] 快讯 | `#portal_block_673 li a` | 标题 + 链接 |
| hot[] 热门轮播 | `#portal_block_672 .swiper-slide` | 标题（data-chh-lg-title）/ 图 / 链接 |
| reviews[] 评测 | `#portal_block_34 .acon li` | 标题 / 图 / 链接 |
| blocks[] | `[id^=portal_block_]` | 门户区块清单（结构探测） |

### forum-index（论坛首页 `/forum.php`）
| 数据 | 来源 |
|---|---|
| categories[] | `#ct div[id^=category_]`（.bm_h h2 名称） |
| forums[] | `table.fl_tb tr`：名称(h2 a)、图标、今日/主题/帖子数(td)、最后发表(td.fl_by) |

### thread-list（版块帖子列表 `forum-XX-1.html`）
| 数据 | 来源 |
|---|---|
| forum | `#ct h1`（名称 + 链接） |
| threads[] | `#threadlist tbody[id]`：`normalthread_*` / `stickthread_*`（置顶）；a.xst 标题；cite a 作者；td.num 回复/查看；td.last 最后发表 |
| filterTabs[] | `#thread_types a, #filter_special a` |
| pagination | `.pg`（strong=当前页） |

### thread-detail（帖子详情 `viewthread`）
| 数据 | 来源 |
|---|---|
| title | `#thread_subject` |
| posts[] | `#postlist div[id^=post_]`：pid、楼层(.pi strong em)、作者(.pls .authi a.xw1 + 头像)、时间(.authi em)、正文(td.t_f，HTML+纯文本)、图片、附件(.pattl)、签名(.sign) |
| breadcrumb | `#pt .z a` |
| views/replies | `#thread_views` / `#thread_replies` |
| pagination | `.pg` |

### messages / notifications / settings / compose
登录态页面，选择器按 Discuz X3.5 默认结构编写，**尚未用登录态验证**，字段允许缺失（rawText 兜底），登录态提取后逐步校准。

## 已知缺口（待登录态验证）

- messages/notifications 的精确选择器
- spacecp 设置项的完整字段表
- 长帖多页详情的合并策略（pagination 翻页合并）
- 移动端 API（`api/mobile/index.php`）可用性——若开放可作为更稳定的数据源

## 隐私

`messages` / `notifications` 的提取结果包含私信与通知内容，仅存 `.omx/`（已 gitignore），**不得提交**。
