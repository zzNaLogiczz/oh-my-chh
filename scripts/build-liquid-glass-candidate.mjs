import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptRoot, "..");
const sourceThemeRoot = join(projectRoot, "src/theming/themes/liquid-glass");
const candidateThemeRoot = join(projectRoot, "dist-candidate/themes/liquid-glass");
const routes = [
  "portal-home",
  "forum-index",
  "thread-list",
  "thread-detail",
  "article-view",
  "profile",
  "settings",
  "messages",
  "compose",
  "unknown"
];
const routeSelectorPattern = /#ct|\.bm|#postlist|#chh-lg-header|rank-badges/;

let shippedBaselineCss;

function readShippedBaselineCss() {
  shippedBaselineCss ??= execFileSync("unzip", ["-p", join(projectRoot, "oh-my-chh-0.1.6.zip"), "themes/liquid-glass/index.css"], {
    encoding: "utf8",
    maxBuffer: 3_000_000
  });
  return shippedBaselineCss;
}

function shippedBaselineSegment(startMarker, endMarker) {
  const css = readShippedBaselineCss();
  const start = css.indexOf(startMarker);
  const end = endMarker ? css.indexOf(endMarker) : css.length;
  if (start < 0 || end < 0 || end <= start) throw new Error(`Unable to read shipped Liquid Glass baseline segment: ${startMarker}`);
  return css.slice(start + startMarker.length, end).trimStart();
}

function isInsideDirectory(parent, child) {
  const childRelativePath = relative(parent, child);
  return childRelativePath === "" || (!childRelativePath.startsWith("..") && !isAbsolute(childRelativePath));
}

async function flattenCssImports(cssFile, seen = new Set()) {
  const resolvedCssFile = resolve(cssFile);
  if (seen.has(resolvedCssFile)) return "";
  seen.add(resolvedCssFile);

  const css = await readFile(resolvedCssFile, "utf8");
  const importPattern = /@import\s+["']((?:\.\.?\/)[^"']+\.css)["'];?/g;
  let output = "";
  let cursor = 0;
  for (const match of css.matchAll(importPattern)) {
    const importPath = resolve(dirname(resolvedCssFile), match[1]);
    if (importPath === resolve(sourceThemeRoot, "routes.css")) {
      throw new Error(`Candidate route CSS must not import or inline ../routes.css: ${relative(sourceThemeRoot, resolvedCssFile)}`);
    }
    output += css.slice(cursor, match.index);
    output += `\n/* inlined ${match[1]} */\n`;
    output += importPath === resolve(sourceThemeRoot, "rank-badges.css")
      ? shippedBaselineSegment("/* inlined rank-badges.css */", null)
      : await flattenCssImports(importPath, seen);
    cursor = (match.index ?? 0) + match[0].length;
  }
  output += css.slice(cursor);
  return output;
}

function routeEntryPath(route) {
  const routeEntry = `routes/${route}.css`;
  const normalizedRouteEntry = normalize(routeEntry);
  const sourceRouteCss = resolve(sourceThemeRoot, normalizedRouteEntry);
  const targetRouteCss = resolve(candidateThemeRoot, normalizedRouteEntry);
  if (!isInsideDirectory(sourceThemeRoot, sourceRouteCss) || !isInsideDirectory(candidateThemeRoot, targetRouteCss)) {
    throw new Error(`Invalid candidate route entrypoint: ${routeEntry}`);
  }
  return { sourceRouteCss, targetRouteCss };
}

await rm(join(projectRoot, "dist-candidate"), { recursive: true, force: true });
await mkdir(candidateThemeRoot, { recursive: true });
await writeFile(join(candidateThemeRoot, "index.css"), await readFile(join(sourceThemeRoot, "tokens.css"), "utf8"));

const candidateIndexCss = await readFile(join(candidateThemeRoot, "index.css"), "utf8");
if (routeSelectorPattern.test(candidateIndexCss)) {
  throw new Error("Candidate index.css must contain only token-level CSS and no route selectors.");
}

for (const route of routes) {
  const { sourceRouteCss, targetRouteCss } = routeEntryPath(route);
  const flattened = await flattenCssImports(sourceRouteCss);
  if (/@import\s+["']\.\.\/routes\.css["'];?/.test(flattened) || flattened.includes("/* inlined ../routes.css */")) {
    throw new Error(`Candidate route CSS must not inline ../routes.css: routes/${route}.css`);
  }
  if (!flattened.includes("/* inlined ../rank-badges.css */")) {
    throw new Error(`Candidate route CSS must inline rank-badges.css at the end: routes/${route}.css`);
  }
  await mkdir(dirname(targetRouteCss), { recursive: true });
  await writeFile(targetRouteCss, flattened.trimStart());
}

for (const route of routes) {
  await readFile(join(candidateThemeRoot, "routes", `${route}.css`), "utf8");
}

console.log("Liquid Glass candidate build written to dist-candidate/themes/liquid-glass");
