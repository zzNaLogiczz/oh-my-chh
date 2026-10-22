// 解析入口：先识别提示页，再按路由分派到各页面解析器
import type { ExcelPage } from "../model";
import { parseForumIndex } from "./forum-index";
import { detectNotice } from "./notice";
import { parseArticle, parsePortalList } from "./portal";
import { detectExcelRoute } from "./route";
import { parseSearch } from "./search";
import { parseThreadDetail } from "./thread-detail";
import { parseThreadList } from "./thread-list";

export const UNSUPPORTED_MESSAGE = "该内容在此模式下不可用";

export function parsePage(doc: Document, url: string): ExcelPage {
  const notice = detectNotice(doc);
  if (notice) return notice;
  switch (detectExcelRoute(new URL(url))) {
    case "forum-index": return parseForumIndex(doc, url);
    case "thread-list": return parseThreadList(doc, url);
    case "thread-detail": return parseThreadDetail(doc, url);
    case "search": return parseSearch(doc, url);
    case "portal-list": return parsePortalList(doc, url);
    case "article": return parseArticle(doc, url);
    default: return { kind: "notice", reason: "unsupported", message: UNSUPPORTED_MESSAGE };
  }
}

export { detectExcelRoute } from "./route";
