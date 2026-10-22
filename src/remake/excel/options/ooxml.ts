// 解析 .xlsx 之前的格式整理：exceljs 只认最常见的写法，而 .NET Open XML SDK 一类生成器的文件
// 合法、Excel 能正常打开，exceljs 却读到一半就崩。这里把两处写法改成 exceljs 认得的样子：
// - SpreadsheetML 元素带命名空间前缀（<x:workbook>）→ 去掉前缀
// - 关系目标是包内绝对路径（/xl/tables/table1.xml）→ 改成相对 rels 所属部件的路径（../tables/table1.xml）
import JSZip from "jszip";

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const PREFIX_DECLARATION = new RegExp(`xmlns:([A-Za-z_][\\w.-]*)="${MAIN_NS.replace(/[.]/g, "\\.")}"`);

/** 根本不是 .xlsx：旧版 .xls、.csv、改了后缀的 Word 文档等；和“格式不支持”分开提示 */
export class NotXlsxError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "NotXlsxError";
  }
}

/** 把 SpreadsheetML 主命名空间的前缀改成默认命名空间；其他命名空间（r:、mc:、x14: 等）不动 */
export function unprefixSpreadsheetXml(xml: string): string {
  const prefix = xml.match(PREFIX_DECLARATION)?.[1];
  if (!prefix) return xml;
  return xml
    .replace(new RegExp(`<(/?)${prefix}:`, "g"), "<$1")
    .replaceAll(`xmlns:${prefix}="${MAIN_NS}"`, `xmlns="${MAIN_NS}"`);
}

/** 包内绝对路径 → 相对路径；基准是 rels 所属部件的目录（xl/worksheets/_rels/sheet1.xml.rels → xl/worksheets） */
function relativeTarget(relsPath: string, target: string): string {
  const from = relsPath.split("/").slice(0, -2);
  const to = target.replace(/^\/+/, "").split("/");
  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared += 1;
  return [...from.slice(shared).map(() => ".."), ...to.slice(shared)].join("/");
}

/** 外部链接（TargetMode="External"）是网址，不是包内路径，不动 */
export function relativizeRelationships(xml: string, relsPath: string): string {
  return xml.replace(/<Relationship\b[^>]*>/g, (tag) => (/\bTargetMode="External"/.test(tag) ? tag
    : tag.replace(/\bTarget="(\/[^"]*)"/, (_, target: string) => `Target="${relativeTarget(relsPath, target)}"`)));
}

/** .xlsx 是 zip 包，且内容类型清单里有 SpreadsheetML 部件 */
async function openXlsx(buffer: ArrayBuffer): Promise<JSZip> {
  const zip = await JSZip.loadAsync(buffer).catch((error: Error) => { throw new NotXlsxError(error.message); });
  const types = await zip.file("[Content_Types].xml")?.async("string");
  if (!types?.includes("spreadsheetml")) throw new NotXlsxError("no SpreadsheetML part in [Content_Types].xml");
  return zip;
}

/** 只在确实改了内容时重新打包，普通文件原样返回 */
export async function normalizeXlsxPackage(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await openXlsx(buffer);
  let changed = false;
  for (const entry of Object.values(zip.files)) {
    const isRels = entry.name.endsWith(".rels");
    if (entry.dir || !(isRels || entry.name.endsWith(".xml"))) continue;
    const xml = await entry.async("string");
    const fixed = isRels ? relativizeRelationships(xml, entry.name) : unprefixSpreadsheetXml(xml);
    if (fixed === xml) continue;
    zip.file(entry.name, fixed);
    changed = true;
  }
  return changed ? zip.generateAsync({ type: "arraybuffer" }) : buffer;
}
