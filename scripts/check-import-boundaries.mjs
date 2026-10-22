import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(projectRoot, "src");
const errors = [];

const sourceExts = new Set([".ts", ".tsx"]);
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

function toPosix(path) {
  return path.split(sep).join("/");
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && sourceExts.has(extname(entry.name))) files.push(full);
  }
  return files;
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? normalize(found) : normalize(base);
}

function inDir(rel, dir) {
  return rel === dir || rel.startsWith(`${dir}/`);
}

const EXCEL = "src/remake/excel";

/**
 * 三个运行上下文各自打包，互相 import 会把不该有的代码带进别的包：
 * - content script（src/platform、excel/host）：页面里运行，不能带 UI 和 exceljs
 * - Excel iframe 应用（excel/app）：扩展源页面，不能依赖页面宿主
 * - 工具栏弹窗（preferences/popup）：只读写设置，不碰页面侧代码
 * exceljs 运行时只允许进工作簿导入页（excel/options），其他地方只能 import type。
 */
function checkImport(fromFile, targetFile, specifier) {
  if (!targetFile || !targetFile.startsWith(srcRoot)) return;
  const fromRel = toPosix(relative(projectRoot, fromFile));
  const targetRel = toPosix(relative(projectRoot, targetFile));
  const deny = (reason) => errors.push(`${fromRel}: ${reason} ${specifier} -> ${targetRel}`);

  if (inDir(fromRel, `${EXCEL}/app`) && (inDir(targetRel, `${EXCEL}/host`) || inDir(targetRel, "src/platform"))) {
    deny("Excel iframe app must not import content-script code");
  }
  if ((inDir(fromRel, `${EXCEL}/host`) || inDir(fromRel, "src/platform")) &&
    (inDir(targetRel, `${EXCEL}/app`) || inDir(targetRel, `${EXCEL}/options`) || inDir(targetRel, "src/preferences/popup"))) {
    deny("content script must not import extension-page UI");
  }
  if (inDir(fromRel, "src/preferences/popup") && (inDir(targetRel, "src/platform") || inDir(targetRel, `${EXCEL}/host`) || inDir(targetRel, `${EXCEL}/app`))) {
    deny("popup must not import page-side code");
  }
}

function checkExcelJs(fromFile, statement, specifier) {
  const fromRel = toPosix(relative(projectRoot, fromFile));
  if (specifier !== "exceljs" || /^import\s+type\s/.test(statement) || inDir(fromRel, `${EXCEL}/options`)) return;
  errors.push(`${fromRel}: exceljs may only be loaded at runtime by the import page (use import type elsewhere)`);
}

for (const file of await walk(srcRoot)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    checkImport(file, resolveImport(file, match[1]), match[1]);
    checkExcelJs(file, match[0], match[1]);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Import boundary check passed");
