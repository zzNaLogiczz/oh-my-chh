#!/usr/bin/env node
// remakeweb：登录态页面解析提取器（DOM → 结构化 JSON）
//
// 用法：
//   node scripts/remake/extract.mjs <route> [url]     # 提取单个路由
//   node scripts/remake/extract.mjs all               # 提取全部路由
//
// 前置：Chrome 已在 9939 端口运行且已登录 chiphell（remakeweb 探专用实例）。
// 输出：.omx/remake-data/<route>.json（+ 提取摘要打印到 stdout）

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { delay, waitForChrome, openPage } from "../liquid-chrome.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptRoot, "..", "..");
const OUT_DIR = join(projectRoot, ".omx", "remake-data");
const DEBUG_PORT = Number(process.env.REMAKE_DEBUG_PORT ?? 9939);

const ROUTES = {
  "portal-home": "https://www.chiphell.com/",
  "forum-index": "https://www.chiphell.com/forum.php",
  "thread-list": "https://www.chiphell.com/forum-283-1.html",
  "thread-detail": "https://www.chiphell.com/forum.php?mod=viewthread&tid=2192109",
  "messages": "https://www.chiphell.com/home.php?mod=space&do=pm",
  "notifications": "https://www.chiphell.com/home.php?mod=space&do=notice",
  "settings": "https://www.chiphell.com/home.php?mod=spacecp",
  "compose": "https://www.chiphell.com/forum.php?mod=post&action=newthread&fid=283",
};

const SETTLE = {
  "portal-home": 6500,
  "forum-index": 5000,
  "thread-list": 5000,
  "thread-detail": 6500,
  "messages": 5500,
  "notifications": 5500,
  "settings": 5000,
  "compose": 6000,
};

async function main() {
  const [routeArg, urlArg] = process.argv.slice(2);
  if (!routeArg || !(routeArg === "all" || ROUTES[routeArg])) {
    console.error("用法: extract.mjs <route|all> [url]\n路由:", Object.keys(ROUTES).join(", "));
    process.exit(1);
  }
  const routes = routeArg === "all" ? Object.keys(ROUTES) : [routeArg];

  // 等待调试端口就绪（实例由外部启动并保持运行）
  await waitForChrome(DEBUG_PORT, { exitCode: null });
  const page = await openPage(DEBUG_PORT);
  await page.command("Page.enable");
  await page.command("Runtime.enable");

  const extractorJs = await readFile(join(scriptRoot, "in-page", "extractors.js"), "utf8");
  await mkdir(OUT_DIR, { recursive: true });

  const summary = [];
  for (const route of routes) {
    const url = urlArg && routes.length === 1 ? urlArg : ROUTES[route];
    process.stdout.write(`[${route}] ${url} ... `);
    await page.command("Page.navigate", { url }).catch(() => {});
    await delay(SETTLE[route] ?? 5000);

    const r1 = await page.command("Runtime.evaluate", { expression: extractorJs, returnByValue: false });
    if (r1.exceptionDetails) {
      console.log("注入失败:", r1.exceptionDetails.text);
      continue;
    }
    const res = await page.command("Runtime.evaluate", {
      expression: `window.__remakeExtractors[${JSON.stringify(route)}]()`,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      console.log("提取失败:", res.exceptionDetails.exception?.description?.slice(0, 200));
      continue;
    }
    const data = res.result.value;
    const outFile = join(OUT_DIR, `${route}.json`);
    await writeFile(outFile, JSON.stringify(data, null, 2));
    const size = Buffer.byteLength(JSON.stringify(data));
    summary.push({ route, keys: Object.keys(data), size });
    console.log(`OK ${size}B -> .omx/remake-data/${route}.json`);

    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) console.log(`    ${k}: ${v.length} 条`);
    }
  }

  await writeFile(join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\n完成 ${summary.length}/${routes.length} 个路由，数据目录: .omx/remake-data/`);
  if (page?.ws) { try { page.ws.close(); } catch {} }
}

main().catch((e) => { console.error(e); process.exit(1); });
