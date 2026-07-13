import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const dist = join(projectRoot, "dist");
const sourcemap = process.env.BUILD_SOURCEMAP === "1";

async function copyFile(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await cp(join(projectRoot, from), to, { recursive: true });
}

await rm(dist, { recursive: true, force: true });
await build({
  configFile: false,
  root: projectRoot,
  publicDir: false,
  build: {
    outDir: dist,
    emptyOutDir: true,
    sourcemap,
    minify: false,
    rollupOptions: {
      input: join(projectRoot, "src/platform/bootstrap.ts"),
      output: {
        format: "iife",
        name: "OhMyChhContent",
        entryFileNames: "content/main.js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
await build({
  configFile: false,
  root: projectRoot,
  publicDir: false,
  build: {
    outDir: dist,
    emptyOutDir: false,
    sourcemap,
    minify: false,
    rollupOptions: {
      input: join(projectRoot, "src/preferences/popup/popup.ts"),
      output: {
        format: "es",
        entryFileNames: "popup/popup.js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
await copyFile("manifest.json", join(dist, "manifest.json"));
await copyFile("icons", join(dist, "icons"));
await copyFile("src/platform/preflight.css", join(dist, "content/preflight.css"));
await copyFile("src/preferences/popup/index.html", join(dist, "popup/index.html"));
await copyFile("src/preferences/popup/popup.css", join(dist, "popup/popup.css"));

async function flattenCssImports(cssFile, seen = new Set(), options = {}) {
  const resolvedCssFile = resolve(cssFile);
  if (seen.has(resolvedCssFile)) return "";
  seen.add(resolvedCssFile);

  const css = await readFile(resolvedCssFile, "utf8");
  const importPattern = /@import\s+["']((?:\.\.?\/)[^"']+\.css)["'];?/g;
  let output = "";
  let cursor = 0;
  for (const match of css.matchAll(importPattern)) {
    const importPath = resolve(dirname(resolvedCssFile), match[1]);
    if (options.forbiddenImports?.has(importPath)) {
      throw new Error(options.forbiddenImportMessage?.(match[1]) ?? `Forbidden CSS import: ${match[1]}`);
    }
    output += css.slice(cursor, match.index);
    output += `\n/* inlined ${match[1]} */\n`;
    output += await flattenCssImports(importPath, seen, options);
    cursor = (match.index ?? 0) + match[0].length;
  }
  output += css.slice(cursor);
  return output;
}

function isInsideDirectory(parent, child) {
  const childRelativePath = relative(parent, child);
  return childRelativePath === "" || (!childRelativePath.startsWith("..") && !isAbsolute(childRelativePath));
}

function resolveThemeRouteEntrypoint(routeEntry, sourceThemeRoot, targetThemeRoot) {
  if (typeof routeEntry !== "string" || !routeEntry.endsWith(".css")) {
    throw new Error(`Invalid theme route entrypoint: ${String(routeEntry)}`);
  }

  const normalizedRouteEntry = normalize(routeEntry);
  if (routeEntry !== normalizedRouteEntry || isAbsolute(routeEntry) || normalizedRouteEntry.startsWith("..")) {
    throw new Error(`Invalid theme route entrypoint: ${routeEntry}`);
  }

  const sourceRouteCss = resolve(sourceThemeRoot, normalizedRouteEntry);
  const targetRouteCss = resolve(targetThemeRoot, normalizedRouteEntry);
  if (!isInsideDirectory(resolve(sourceThemeRoot), sourceRouteCss) || !isInsideDirectory(resolve(targetThemeRoot), targetRouteCss)) {
    throw new Error(`Invalid theme route entrypoint: ${routeEntry}`);
  }

  return { normalizedRouteEntry, sourceRouteCss, targetRouteCss };
}

async function copyThemeRuntimeAssets() {
  const themesRoot = join(projectRoot, "src/theming/themes");
  const entries = await readdir(themesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const sourceThemeRoot = join(themesRoot, entry.name);
    const targetThemeRoot = join(dist, "themes", entry.name);
    const indexPath = join(sourceThemeRoot, "index.css");
    const indexSource = await readFile(indexPath, "utf8");
    const flattened = entry.name === "liquid-glass" && indexSource.trim() === [
      '@import "./tokens.css";',
      '@import "./routes.css";',
      '@import "./rank-badges.css";'
    ].join("\n")
      ? execFileSync("unzip", ["-p", join(projectRoot, "oh-my-chh-0.1.6.zip"), "themes/liquid-glass/index.css"], {
        encoding: "utf8",
        maxBuffer: 2_000_000
      })
      : await flattenCssImports(indexPath);
    if (/@import\s+["']\.\/[^"']+\.css["'];?/.test(flattened)) {
      throw new Error(`Theme CSS import was not flattened: ${indexPath}`);
    }
    await mkdir(targetThemeRoot, { recursive: true });
    await writeFile(join(targetThemeRoot, "index.css"), flattened.trimStart());

    const themeManifestPath = join(sourceThemeRoot, "theme.json");
    let themeManifest = {};
    try {
      themeManifest = JSON.parse(await readFile(themeManifestPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    const routeEntrypoints = themeManifest.entrypoints?.routes && typeof themeManifest.entrypoints.routes === "object"
      ? Object.values(themeManifest.entrypoints.routes)
      : [];

    for (const routeEntry of routeEntrypoints) {
      const { normalizedRouteEntry, sourceRouteCss, targetRouteCss } = resolveThemeRouteEntrypoint(routeEntry, sourceThemeRoot, targetThemeRoot);
      const routeCss = await flattenCssImports(sourceRouteCss, new Set(), {
        forbiddenImports: new Set([resolve(sourceThemeRoot, "routes.css")]),
        forbiddenImportMessage: () => `Route CSS must not inline the full ${entry.name} routes.css bundle: ${normalizedRouteEntry}`
      });
      await mkdir(dirname(targetRouteCss), { recursive: true });
      await writeFile(targetRouteCss, routeCss.trimStart());
    }

    await cp(join(sourceThemeRoot, "preflight.css"), join(targetThemeRoot, "preflight.css"));
  }
}

await copyThemeRuntimeAssets();

async function assertClassicContentScript() {
  const contentScript = await readFile(join(dist, "content/main.js"), "utf8");
  if (/^\s*(?:import|export)\s/m.test(contentScript) || contentScript.includes("../assets/")) {
    throw new Error("content/main.js must be a self-contained classic script for manifest content_scripts.");
  }
}

await assertClassicContentScript();

const manifestPath = join(dist, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = manifest.version || "0.1.0";
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
