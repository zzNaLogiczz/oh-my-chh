import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const themesDir = join(root, "src/theming/themes");
const allowedAtRules = /^(?:@import|@media|@supports|@keyframes|from\b|to\b|\d+%)/;
const errors = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    if (entry.isFile() && entry.name.endsWith(".css")) await check(full);
  }
}

function stripBlocks(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

async function check(file) {
  const css = stripBlocks(await readFile(file, "utf8"));
  const matches = css.matchAll(/(^|})\s*([^{}@][^{}]*)\{/gm);
  for (const match of matches) {
    const selectorList = match[2].trim();
    if (!selectorList || allowedAtRules.test(selectorList)) continue;
    for (const selector of selectorList.split(",")) {
      const s = selector.trim();
      if (!s) continue;
      if (!s.startsWith("html[data-omchh-enabled=\"1\"][data-omchh-theme=")) {
        errors.push(`${file}: unscoped selector: ${s}`);
      }
    }
  }
}

await walk(themesDir);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("CSS scope check passed");
