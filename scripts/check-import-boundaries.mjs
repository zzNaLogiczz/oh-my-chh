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

function isThemingImplementation(rel) {
  return inDir(rel, "src/theming/themes") || rel === "src/theming/registry.ts" || rel === "src/theming/theme-module.ts";
}

function isCatalog(rel) {
  return rel === "src/theming/catalog.ts" || rel === "src/capabilities/catalog.ts";
}

function isPreferencesPlatformException(fromRel, targetRel) {
  return fromRel === "src/preferences/settings.ts" && targetRel === "src/platform/extension-context.ts";
}

function checkImport(fromFile, targetFile, specifier) {
  if (!targetFile || !targetFile.startsWith(srcRoot)) return;
  const fromRel = toPosix(relative(projectRoot, fromFile));
  const targetRel = toPosix(relative(projectRoot, targetFile));

  if (inDir(fromRel, "src/foundation") && (
    inDir(targetRel, "src/theming") ||
    inDir(targetRel, "src/capabilities") ||
    inDir(targetRel, "src/preferences") ||
    inDir(targetRel, "src/platform") ||
    inDir(targetRel, "src/features")
  )) {
    errors.push(`${fromRel}: foundation must not import upper context ${specifier} -> ${targetRel}`);
  }

  if (inDir(fromRel, "src/preferences") && !isCatalog(targetRel) && !isPreferencesPlatformException(fromRel, targetRel) && (
    isThemingImplementation(targetRel) ||
    inDir(targetRel, "src/capabilities/registry") ||
    inDir(targetRel, "src/features") ||
    inDir(targetRel, "src/foundation") ||
    inDir(targetRel, "src/platform")
  )) {
    errors.push(`${fromRel}: preferences/popup may import schema and catalogs, not implementation ${specifier} -> ${targetRel}`);
  }

  if (inDir(fromRel, "src/capabilities") && targetRel.endsWith(".css")) {
    errors.push(`${fromRel}: capabilities must not import css ${specifier}`);
  }
}

async function checkNoCapabilityCss() {
  const dir = join(srcRoot, "capabilities");
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".css")) {
      errors.push(`src/capabilities/${entry.name}: capabilities must not contain CSS files`);
    }
  }
}

for (const file of await walk(srcRoot)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    checkImport(file, resolveImport(file, match[1]), match[1]);
  }
}

await checkNoCapabilityCss();

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Import boundary check passed");
