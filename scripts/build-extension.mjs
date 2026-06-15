import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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

async function flattenCssImports(cssFile, seen = new Set()) {
  if (seen.has(cssFile)) return "";
  seen.add(cssFile);

  const css = await readFile(cssFile, "utf8");
  const importPattern = /@import\s+["']\.\/([^"']+\.css)["'];?/g;
  let output = "";
  let cursor = 0;
  for (const match of css.matchAll(importPattern)) {
    output += css.slice(cursor, match.index);
    output += `\n/* inlined ${match[1]} */\n`;
    output += await flattenCssImports(join(dirname(cssFile), match[1]), seen);
    cursor = (match.index ?? 0) + match[0].length;
  }
  output += css.slice(cursor);
  return output;
}

async function copyThemeRuntimeAssets() {
  const themesRoot = join(projectRoot, "src/theming/themes");
  const entries = await readdir(themesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const sourceThemeRoot = join(themesRoot, entry.name);
    const targetThemeRoot = join(dist, "themes", entry.name);
    const indexPath = join(sourceThemeRoot, "index.css");
    const flattened = await flattenCssImports(indexPath);
    if (/@import\s+["']\.\/[^"']+\.css["'];?/.test(flattened)) {
      throw new Error(`Theme CSS import was not flattened: ${indexPath}`);
    }
    await mkdir(targetThemeRoot, { recursive: true });
    await writeFile(join(targetThemeRoot, "index.css"), flattened.trimStart());
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
