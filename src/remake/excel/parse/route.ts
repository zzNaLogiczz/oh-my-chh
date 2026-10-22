// URL → Excel 皮肤路由：论坛四类页面 + 门户频道列表 / 文章 + 门户首页入口，其余一律 unsupported
import type { ExcelRoute } from "../model";

export function detectExcelRoute(url: URL): ExcelRoute {
  const path = url.pathname;
  const params = url.searchParams;
  const mod = params.get("mod");

  if (path === "/") return "portal-home";
  if (/^\/article-\d+-\d+\.html$/.test(path)) return "article";
  if (path === "/portal.php") {
    if (mod === null || mod === "index") return "portal-home";
    if (mod === "list" && params.has("catid")) return "portal-list";
    if (mod === "view" && params.has("aid")) return "article";
    return "unsupported";
  }
  if (/^\/forum-\d+-\d+\.html$/.test(path)) return "thread-list";
  if (/^\/thread-\d+-\d+-\d+\.html$/.test(path)) return "thread-detail";
  if (path === "/search.php" && (mod === null || mod === "forum")) return "search";
  if (path === "/forum.php") {
    if (mod === null || mod === "index") return "forum-index";
    if (mod === "forumdisplay" && params.has("fid")) return "thread-list";
    if (mod === "viewthread" && params.has("tid")) return "thread-detail";
  }
  return "unsupported";
}
