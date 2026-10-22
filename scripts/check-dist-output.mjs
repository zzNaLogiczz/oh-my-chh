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
  "dist/manifest.json",
  "dist/content/main.js",
  "dist/content/preflight.css",
  "dist/popup/index.html",
  "dist/popup/popup.js",
  "dist/popup/popup.css",
  "dist/excel/app.html",
  "dist/excel/app.js",
  "dist/excel/app.css",
  "dist/excel/options.html",
  "dist/excel/options.js",
  "dist/excel/options.css"
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) fail(`Missing build artifact: ${path}`);
}

const forbiddenFiles = listFiles().filter((file) => /\.(?:ts|tsx|md|map)$/.test(file) || file.startsWith("dist/themes/"));
if (forbiddenFiles.length > 0) {
  fail(`Forbidden source or retired theme artifacts in dist:\n${forbiddenFiles.join("\n")}`);
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
if (manifest.content_scripts.length !== 1) fail("manifest must declare exactly one content script");
if (manifest.content_scripts[0].js[0] !== "content/main.js") fail("manifest js path changed");
if (manifest.content_scripts[0].css[0] !== "content/preflight.css") fail("manifest css path changed");

console.log("Dist output invariants passed");
