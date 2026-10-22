import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

/** 单入口打包：content script 必须是自包含的经典脚本（iife），扩展页面用 ES module */
async function bundle(input, output, format, name) {
  await build({
    configFile: false,
    root: projectRoot,
    publicDir: false,
    logLevel: "warn",
    build: {
      outDir: dist,
      emptyOutDir: false,
      sourcemap,
      minify: true,
      rollupOptions: {
        input: join(projectRoot, input),
        output: { format, name, entryFileNames: output, assetFileNames: "assets/[name]-[hash][extname]" }
      }
    }
  });
}

await rm(dist, { recursive: true, force: true });
// 内容脚本：document_start 读取皮肤，Excel 皮肤接管整页
await bundle("src/platform/bootstrap.ts", "content/main.js", "iife", "OhMyChhContent");
// 工具栏弹窗：皮肤选择 + 当前皮肤的设置
await bundle("src/preferences/popup/popup.ts", "popup/popup.js", "es");
// Excel 皮肤：全屏 iframe 应用（扩展源页面，渲染论坛视图与老板键工作簿）
await bundle("src/remake/excel/app/main.ts", "excel/app.js", "es");
// Excel 皮肤：工作簿导入页，exceljs 只进这个包，不进 content script
await bundle("src/remake/excel/options/options-main.ts", "excel/options.js", "es");

await copyFile("manifest.json", join(dist, "manifest.json"));
await copyFile("icons", join(dist, "icons"));
await copyFile("src/platform/preflight.css", join(dist, "content/preflight.css"));
await copyFile("src/preferences/popup/index.html", join(dist, "popup/index.html"));
await copyFile("src/preferences/popup/popup.css", join(dist, "popup/popup.css"));
await copyFile("src/remake/excel/app/app.html", join(dist, "excel/app.html"));
await copyFile("src/remake/excel/app/app.css", join(dist, "excel/app.css"));
await copyFile("src/remake/excel/options/options.html", join(dist, "excel/options.html"));
await copyFile("src/remake/excel/options/options.css", join(dist, "excel/options.css"));

const contentScript = await readFile(join(dist, "content/main.js"), "utf8");
if (/^\s*(?:import|export)\s/m.test(contentScript) || contentScript.includes("../assets/")) {
  throw new Error("content/main.js must be a self-contained classic script for manifest content_scripts.");
}

const manifestPath = join(dist, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
