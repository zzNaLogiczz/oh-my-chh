// 同源抓取 chh 页面并解析为 Excel 数据（沿用当前标签页的登录会话）
import type { ExcelPage } from "../model";
import { parsePage } from "../parse";

const ALLOWED_ORIGIN = "https://www.chiphell.com";

export async function fetchExcelPage(url: string): Promise<{ page: ExcelPage; url: string }> {
  // 只允许站内地址，防止被诱导请求其他站点
  if (new URL(url).origin !== ALLOWED_ORIGIN) throw new Error(`blocked origin: ${url}`);
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const finalUrl = response.url || url;
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");
  return { page: parsePage(doc, finalUrl), url: finalUrl };
}
