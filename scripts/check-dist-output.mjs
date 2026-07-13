import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import golden from "../test/fixtures/liquid-glass-016-css-golden.json" with { type: "json" };

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
const liquidGlassIndex = join(root, "dist/themes/liquid-glass/index.css");
const liquidGlassIndexHash = createHash("sha256").update(readFileSync(liquidGlassIndex)).digest("hex");
if (liquidGlassIndexHash !== golden.liquidGlass.files["themes/liquid-glass/index.css"].sha256) {
  fail("Default Liquid Glass index.css no longer matches the 0.1.6 golden hash before promotion.");
}

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

const leakedCandidateArtifacts = files.filter((file) => file.includes("dist-candidate"));
if (leakedCandidateArtifacts.length > 0) {
  fail(`Default dist must not include candidate artifacts:\n${leakedCandidateArtifacts.join("\n")}`);
}

const liquidGlassRoutes = files.filter((file) => file.startsWith("dist/themes/liquid-glass/routes/"));
if (liquidGlassRoutes.length > 0) {
  fail(`Liquid Glass 0.1.6 baseline must not ship route CSS files:\n${liquidGlassRoutes.join("\n")}`);
}

const liquidGlassThemeJson = join(root, "dist/themes/liquid-glass/theme.json");
if (existsSync(liquidGlassThemeJson)) {
  const themeJson = JSON.parse(readFileSync(liquidGlassThemeJson, "utf8"));
  if (themeJson.entrypoints?.routes) {
    fail("Default dist theme.json must not ship candidate Liquid Glass route entrypoints before promotion.");
  }
}

const liquidGlassSourceRoutesRoot = join(root, "src/theming/themes/liquid-glass/routes");
if (existsSync(liquidGlassSourceRoutesRoot)) {
  const wrapperRoutes = readdirSync(liquidGlassSourceRoutesRoot)
    .filter((file) => file.endsWith(".css"))
    .filter((file) => readFileSync(join(liquidGlassSourceRoutesRoot, file), "utf8").includes('@import "../routes.css";'));
  if (wrapperRoutes.length > 0) {
    fail(`Liquid Glass route files must not import the full routes.css bundle:\n${wrapperRoutes.join("\n")}`);
  }
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
if (manifest.content_scripts[0].js[0] !== "content/main.js") fail("manifest js path changed");
if (manifest.content_scripts[0].css[0] !== "content/preflight.css") fail("manifest css path changed");

console.log("Dist output invariants passed");
