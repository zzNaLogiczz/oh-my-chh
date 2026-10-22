// Excel 皮肤的数据契约：content script 解析 chh 页面 → 结构化数据 → 经端口发给 iframe 渲染
// 全部为可结构化克隆的纯数据；任何字段缺失用 null / 空数组表示，渲染层负责隐藏或占位

export type ExcelRoute =
  | "forum-index" | "thread-list" | "thread-detail" | "search"
  | "portal-list" | "article" | "portal-home" | "unsupported";

/** pageUrlTemplate：任意页地址模板，页码处为 {page}；单页或无分页时为 null */
export interface PageInfo { page: number; totalPages: number; nextUrl: string | null; prevUrl: string | null; pageUrlTemplate: string | null }

export interface NavLink { name: string; url: string }
/** 页头频道导航：一级频道 + 悬停展开的二级分类 */
export interface NavChannel { name: string; url: string; subs: NavLink[] }

export interface ForumEntry {
  fid: string; name: string; url: string;
  today: number | null; threads: number | null; posts: number | null;
  lastPostAt: string | null; lastPostTitle: string | null; lastPostBy: string | null;
}
export interface ForumCategory { id: string; name: string; forums: ForumEntry[] }
export interface ForumIndexPage { kind: "forum-index"; channels: NavChannel[]; categories: ForumCategory[] }

export interface ThreadRow {
  tid: string; title: string; url: string;
  author: string | null; createdAt: string | null;
  replies: number | null; views: number | null;
  lastPostAt: string | null; lastPostBy: string | null;
  pinned: boolean;
}
/** parent：“返回上级”的目标（帖子 → 所在版块对应页，列表 → 版块列表） */
export interface ThreadListPage { kind: "thread-list"; fid: string; forumName: string; threads: ThreadRow[]; pageInfo: PageInfo; parent: NavLink | null }

export type PostBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; name: string }
  | { kind: "quote"; author: string | null; text: string };
/** 该楼“回复”按钮的方式：repquote 引用并通知层主，reppost（楼主那一楼）只通知不引用 */
export type FloorReplyMode = "repquote" | "reppost";
/**
 * label：楼层列显示的文字（文章正文为“正文”），缺省显示 floor
 * replyMode：缺省表示这一楼不能单独答复（文章评论、没有回复按钮的楼层）
 */
export interface Post {
  pid: string; floor: number; label?: string; author: string; avatar: string | null;
  postedAt: string | null; locked: boolean; blocks: PostBlock[]; replyMode?: FloorReplyMode;
}
/** 回帖凭据：页面带快速回复框时才有（已登录、帖子未关闭、有回帖权限） */
export interface ReplyForm { fid: string; formhash: string }
export interface ThreadDetailPage {
  kind: "thread-detail"; tid: string; title: string; forumName: string | null;
  views: number | null; replies: number | null; posts: Post[]; pageInfo: PageInfo; parent: NavLink | null;
  reply: ReplyForm | null;
}

export interface SearchRow {
  tid: string; title: string; url: string;
  replies: number | null; views: number | null; snippet: string;
  postedAt: string | null; author: string | null; forumName: string | null;
}
export interface SearchPage { kind: "search"; keyword: string; total: number | null; results: SearchRow[]; pageInfo: PageInfo; parent: NavLink | null }

export interface ArticleRow {
  aid: string; title: string; url: string; category: string | null; categoryUrl: string | null; postedAt: string | null; summary: string;
}
export interface PortalListPage {
  kind: "portal-list"; catid: string; name: string; articles: ArticleRow[]; pageInfo: PageInfo; parent: NavLink | null;
}
/** 门户文章：posts[0] 为本页正文，第一页之后追加最新评论（与帖子详情共用网格 + 批注窗格） */
export interface ArticlePage {
  kind: "article"; aid: string; title: string; views: number | null; comments: number | null;
  posts: Post[]; pageInfo: PageInfo; parent: NavLink | null;
}

export interface NoticePage { kind: "notice"; reason: "login-required" | "unsupported" | "message"; message: string }

export type ExcelPage = ForumIndexPage | ThreadListPage | ThreadDetailPage | SearchPage | PortalListPage | ArticlePage | NoticePage;
