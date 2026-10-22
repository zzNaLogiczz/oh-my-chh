#!/usr/bin/env node
// Excel 皮肤解析测试夹具：从登录态抓取的原始 HTML（.omx/excel-recon，gitignore）生成可入库的脱敏夹具
//
// 用法：node scripts/remake/make-excel-fixtures.mjs
// 处理：删除帖子正文（td.t_f）以外的 <script>；删除 #hd/#ft/#um 与 formhash 输入（保留 #hd 内的
//       频道导航 #nv 与二级菜单 mn_*_menu，移到 body 开头）；
//       登录用户名替换为 tester，登录 uid（含头像路径里拆开的 uid）换成 100000，URL 中的 formhash 置零，
//       RSS 链接的 auth（由 uid 和密码哈希片段加密而成，能以本人身份读 RSS）换成未登录时的 0。
//       登录身份从全部原始页面里识别（discuz_uid 与页头“访问我的空间”链接）后统一替换，脚本里不写任何账号信息；
//       生成后再检查一遍，任何夹具里还留着登录身份就报错退出。

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(projectRoot, ".omx", "excel-recon");
const OUT = join(projectRoot, "test", "fixtures", "excel");
const PLACEHOLDER_NAME = "tester";
const PLACEHOLDER_UID = "100000";
const FILES = [
  "forum-index", "thread-list", "thread-detail", "thread-detail-p2", "thread-2904948", "search",
  "portal-list", "portal-list-sub", "article", "article-p2"
];

/** Discuz 头像路径：uid 补零到 9 位后按 3/2/2/2 拆目录，如 000/12/34/56_avatar_middle.jpg */
function avatarPath(uid) {
  const padded = uid.padStart(9, "0");
  return `${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${padded.slice(7, 9)}_avatar`;
}

/** 登录身份：页面脚本里的 discuz_uid，以及页头“访问我的空间”链接上的用户名（各页面页头结构不同，只认这个链接） */
function loginIdentity(html) {
  const doc = new JSDOM(html).window.document;
  const uid = html.match(/discuz_uid\s*=\s*'(\d+)'/)?.[1];
  const name = doc.querySelector('a[title="访问我的空间"]')?.textContent?.trim();
  return { uids: uid && uid !== "0" ? [uid] : [], names: name ? [name] : [] };
}

function sanitize(html, login) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const script of doc.querySelectorAll("script")) {
    if (!script.closest("td.t_f")) script.remove();
  }
  const nav = [...doc.querySelectorAll("#nv, ul[id^=mn_][id$=_menu]")];
  for (const node of doc.querySelectorAll("#hd, #ft, #um, input[name=formhash]")) node.remove();
  doc.body.prepend(...nav);
  let out = dom.serialize();
  for (const name of login.names) out = out.replaceAll(name, PLACEHOLDER_NAME);
  for (const uid of login.uids) {
    out = out
      .replaceAll(avatarPath(uid), avatarPath(PLACEHOLDER_UID))
      .replace(new RegExp(`\\b${uid}\\b`, "g"), PLACEHOLDER_UID);
  }
  return out
    .replace(/formhash=[0-9a-f]+/g, "formhash=00000000")
    .replace(/([?&;]auth=)[^"'&\s]+/g, "$10");
}

const raws = await Promise.all(FILES.map((name) => readFile(join(SRC, `${name}.raw.html`), "utf8")));
// 有的页面认不出登录身份（页头结构不同），所以先汇总全部页面的身份，再逐个替换
const login = { uids: [], names: [] };
for (const found of raws.map(loginIdentity)) {
  login.uids.push(...found.uids.filter((uid) => !login.uids.includes(uid)));
  login.names.push(...found.names.filter((name) => !login.names.includes(name)));
}
if (!login.uids.length || !login.names.length) throw new Error("没认出登录身份：原始页面应来自登录态");
const leaks = (text) => [...login.names, ...login.uids.map(avatarPath)].filter((needle) => text.toLowerCase().includes(needle.toLowerCase()))
  .concat(login.uids.filter((uid) => new RegExp(`\\b${uid}\\b`).test(text)))
  .concat(text.match(/formhash=(?!0{8})[0-9a-f]+|[?&;]auth=(?!0\b)[^"'&\s]+/g) ?? []);

await mkdir(OUT, { recursive: true });
for (const [index, name] of FILES.entries()) {
  const clean = sanitize(raws[index], login);
  if (leaks(clean).length) throw new Error(`${name}: 夹具里还留着登录身份`);
  await writeFile(join(OUT, `${name}.html`), clean);
  console.log(`${name}.html ${clean.length}B`);
}
