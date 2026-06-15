import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

function fail(message) {
  throw new Error(message);
}

function listFiles(dir = dist) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath.replace(`${root}/`, "")];
  });
}

const requiredPaths = [
  "dist/content/main.js",
  "dist/content/preflight.css",
  "dist/popup/index.html",
  "dist/popup/popup.css",
  "dist/popup/popup.js",
  "dist/themes/liquid-glass/index.css",
  "dist/themes/liquid-glass/preflight.css",
  "dist/themes/flat-clean/index.css",
  "dist/themes/flat-clean/preflight.css"
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) fail(`Missing build artifact: ${path}`);
}

const files = listFiles();
const forbiddenFiles = files.filter(
  (file) =>
    /\.(?:ts|md|map)$/.test(file) ||
    file.includes("/adapter/") ||
    file === "dist/themes/liquid-glass/routes.css" ||
    file === "dist/themes/liquid-glass/tokens.css" ||
    file === "dist/themes/liquid-glass/rank-badges.css" ||
    file === "dist/themes/liquid-glass/preview.html"
);

if (forbiddenFiles.length > 0) {
  fail(`Forbidden debug/source artifacts in dist:\n${forbiddenFiles.join("\n")}`);
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
if (manifest.content_scripts[0].js[0] !== "content/main.js") fail("manifest js path changed");
if (manifest.content_scripts[0].css[0] !== "content/preflight.css") fail("manifest css path changed");

console.log("Dist output invariants passed");
