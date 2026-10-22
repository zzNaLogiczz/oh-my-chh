// 帖子列表解析：#threadlisttableid 下的 stickthread_* / normalthread_* tbody
import type { ThreadListPage, ThreadRow } from "../model";
import { absUrl, exactCount, forumIndexLink, idFromHref, parsePageInfo, text, timeText } from "./common";

function parseThreadRow(body: Element, base: string): ThreadRow | null {
  const link = body.querySelector("a.xst");
  const url = absUrl(link?.getAttribute("href"), base);
  const tid = body.id.replace(/^(?:stick|normal)thread_/, "") || idFromHref(link?.getAttribute("href"), "thread");
  if (!link || !url || !tid) return null;

  // 第一个 td.by 是作者/发表时间，第二个是最后回复人/时间
  const [authorCell, lastCell] = body.querySelectorAll("td.by");
  const num = body.querySelector("td.num");
  return {
    tid, title: text(link), url,
    author: text(authorCell?.querySelector("cite a")) || null,
    createdAt: timeText(authorCell?.querySelector("em")),
    replies: exactCount(num?.querySelector("a")),
    views: exactCount(num?.querySelector("em")),
    lastPostAt: timeText(lastCell?.querySelector("em")),
    lastPostBy: text(lastCell?.querySelector("cite a")) || null,
    pinned: body.id.startsWith("stickthread_")
  };
}

export function parseThreadList(doc: Document, base: string): ThreadListPage {
  const forumLink = doc.querySelector("#ct h1 a");
  const threads: ThreadRow[] = [];
  for (const body of doc.querySelectorAll("tbody[id^=stickthread_], tbody[id^=normalthread_]")) {
    const row = parseThreadRow(body, base);
    if (row) threads.push(row);
  }
  // 置顶帖在 DOM 中本就靠前；稳定排序保证即便模板变化也先置顶
  threads.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return {
    kind: "thread-list",
    fid: idFromHref(forumLink?.getAttribute("href"), "forum") ?? idFromHref(base, "forum") ?? "",
    forumName: text(forumLink),
    threads,
    pageInfo: parsePageInfo(doc, base),
    parent: forumIndexLink(base)
  };
}
