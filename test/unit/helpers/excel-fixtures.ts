import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIXTURE_BASE = "https://www.chiphell.com/";

/** 读取 test/fixtures/excel 下的脱敏 HTML 夹具并解析为 Document */
export function loadExcelFixture(name: string): Document {
  const html = readFileSync(join(process.cwd(), "test/fixtures/excel", `${name}.html`), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}
