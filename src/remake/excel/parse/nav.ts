// 页头频道导航：#nv 一级频道 + mn_*_menu 二级分类（只收门户频道，首页与社区就是版块列表本身）
import type { NavChannel, NavLink } from "../model";
import { absUrl, text } from "./common";
import { detectExcelRoute } from "./route";

function isChannel(url: string): boolean {
  return detectExcelRoute(new URL(url)) === "portal-list";
}

export function parseNavChannels(doc: Document, base: string): NavChannel[] {
  const channels: NavChannel[] = [];
  for (const item of doc.querySelectorAll("#nv > ul > li[id^=mn_]")) {
    const link = item.querySelector(":scope > a");
    const url = absUrl(link?.getAttribute("href"), base);
    if (!link || !url || !isChannel(url)) continue;
    const menu = doc.getElementById(`${item.id}_menu`);
    const subs: NavLink[] = [...(menu?.querySelectorAll("a[href]") ?? [])]
      .map((a) => ({ name: text(a), url: absUrl(a.getAttribute("href"), base) ?? "" }))
      .filter((sub) => sub.name && sub.url);
    channels.push({ name: text(link), url, subs });
  }
  return channels;
}
