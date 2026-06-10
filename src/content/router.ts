export type OmchhRoute =
  | "portal-home"
  | "forum-index"
  | "thread-list"
  | "thread-detail"
  | "article-view"
  | "profile"
  | "settings"
  | "messages"
  | "compose"
  | "unknown";

function bodyHas(...tokens: string[]): boolean {
  const body = document.body;
  if (!body) return false;
  return tokens.every((token) => body.classList.contains(token) || body.id === token);
}

export function detectRoute(locationLike: Location = window.location): OmchhRoute {
  const path = locationLike.pathname;
  const search = locationLike.search;
  const params = new URLSearchParams(search);
  const mod = params.get("mod") ?? "";
  const doParam = params.get("do") ?? "";

  if (/\/post\.php$/i.test(path) || (path.endsWith("/forum.php") && mod === "post") || bodyHas("pg_post")) return "compose";
  // 设置/控制面板（修改头像、个人资料、安全等）：mod=spacecp，body 标记 pg_spacecp
  if (mod === "spacecp" || bodyHas("pg_spacecp")) return "settings";
  // 消息中心（私人消息/公共消息/系统通知）：mod=space 且 do=pm/notice；须在 profile 之前判定，
  // 因为本页 body 同为 pg_space 且无 uid，会被 profile 的 body 回退分支误判
  if (mod === "space" && (doParam === "pm" || doParam === "notice")) return "messages";
  if (/\/thread-\d+-\d+-\d+\.html$/i.test(path) || mod === "viewthread" || bodyHas("pg_viewthread")) return "thread-detail";
  if (/\/article-\d+-\d+\.html$/i.test(path) || (bodyHas("nv_portal", "pg_view") && document.querySelector(".bm.vw, .vw"))) return "article-view";
  if (/\/space-uid-\d+\.html$/i.test(path) || (mod === "space" && params.has("uid")) || bodyHas("nv_home", "pg_space")) return "profile";
  if (/\/forum-\d+-\d+\.html$/i.test(path) || mod === "forumdisplay" || bodyHas("pg_forumdisplay")) return "thread-list";
  if (/\/forum\.php$/i.test(path) || bodyHas("nv_forum", "pg_index")) return "forum-index";
  if (/\/portal\.php$/i.test(path) || path === "/" || bodyHas("nv_portal", "pg_index")) return "portal-home";
  return "unknown";
}
