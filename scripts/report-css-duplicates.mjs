import { readFileSync } from "node:fs";
import { join } from "node:path";

const target = process.argv[2] ?? "src/theming/themes/liquid-glass/routes.css";
const path = join(process.cwd(), target);
const css = readFileSync(path, "utf8");
const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
const blocks = [...css.matchAll(blockPattern)].map((match) => ({
  selector: match[1].trim().replace(/\s+/g, " "),
  body: match[2].trim().replace(/\s+/g, " ")
}));

const selectorCounts = new Map();
const fullBlockCounts = new Map();
for (const block of blocks) {
  selectorCounts.set(block.selector, (selectorCounts.get(block.selector) ?? 0) + 1);
  const key = `${block.selector}{${block.body}}`;
  fullBlockCounts.set(key, (fullBlockCounts.get(key) ?? 0) + 1);
}

const duplicateSelectors = [...selectorCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1]);
const exactDuplicateSurplus = [...fullBlockCounts.values()]
  .filter((count) => count > 1)
  .reduce((total, count) => total + count - 1, 0);

console.log(JSON.stringify({
  file: target,
  bytes: Buffer.byteLength(css),
  lines: css.split("\n").length,
  blocks: blocks.length,
  duplicateSelectors: duplicateSelectors.length,
  exactDuplicateSurplus,
  topDuplicateSelectors: duplicateSelectors.slice(0, 10).map(([selector, count]) => ({ count, selector }))
}, null, 2));
