#!/usr/bin/env python3
"""remakeweb v5：纯卡片布局，全部使用 shadcn/Spectrum 组件的标准 DOM 与类名。
渲染管线：Tailwind CDN + shadcn 令牌（CSS 变量 + alpha-value），亮/暗双主题。"""
import json, re, html
from pathlib import Path

ROOT = Path("/Users/zznalogic/projects/chh/oh-my-chh")
DATA = ROOT / ".omx/remake-data"
OUT = ROOT / ".omx/spectrum-review/remake-home-v5.html"

portal = json.load(open(DATA / "portal-home.json", encoding="utf-8"))
forum = json.load(open(DATA / "forum-index.json", encoding="utf-8"))
threads = json.load(open(DATA / "thread-list.json", encoding="utf-8"))

def esc(s):
    return html.escape(s or "", quote=True)

def clean_review(t):
    m = re.match(r"(.*?)\s+(20\d{2}-\d{2}-\d{2})\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*)", t or "")
    if m:
        return {"title": m.group(1).strip(), "date": m.group(2), "views": int(m.group(3)),
                "replies": int(m.group(4)), "category": m.group(5)}
    return {"title": t, "date": "", "views": None, "replies": None, "category": ""}

hot = portal["hot"]
news = portal["news"]
reviews = [clean_review(r["title"]) | {"url": r["url"], "image": r["image"]} for r in portal["reviews"]]
threads = [t for t in threads["threads"] if not t["pinned"]][:7]
cats = [c for c in forum["categories"] if c["forums"]][:4]

NAV = [
    ("首页", "#", None), ("评测", "#", None),
    ("电脑", "#", ["视频评测", "笔记本", "机箱", "处理器", "散热器", "主板", "内存", "显卡", "显示设备", "外设", "电源", "存储", "台式机"]),
    ("掌设", "#", ["智能手机", "平板", "智能穿戴"]),
    ("摄影", "#", ["微单", "单反", "旁轴", "菲林", "镜头", "摄像"]),
    ("照片", "#", ["人物肖像", "风景游记", "静物", "人文扫街"]),
    ("汽车", "#", ["买菜车", "性能车", "SUV", "MPV", "摩托轻骑", "改装配件"]),
    ("单车", "#", ["公路车", "山地车", "折叠车", "休旅车"]),
    ("模型", "#", ["人偶手办", "比例成品", "拼装", "RC遥控"]),
    ("败家", "#", ["开箱", "收纳", "体验分享"]),
    ("时尚", "#", ["鞋类服饰", "箱包"]),
    ("腕表", "#", ["机械表", "电子表"]),
    ("视听", "#", ["耳机耳放", "音箱功放", "解码转盘", "随身设备"]),
    ("美食", "#", ["当地美食", "世界美食", "美食器材"]),
    ("家居", "#", ["品质生活"]),
    ("活宠", "#", ["育儿分享"]),
    ("文化", "#", ["读书", "影音"]),
    ("社区", "#", None),
]

nav_parts = []
for name, url, subs in NAV:
    active = " bg-primary text-primary-fg hover:bg-primary/90" if name == "首页" else " hover:bg-accent hover:text-accent-foreground"
    dd = ""
    if subs:
        items = "".join(
            '<a href="#" class="block w-full select-none rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground">'
            + html.escape(s) + "</a>" for s in subs)
        dd = ('<div class="dropdown hidden group-hover:block absolute z-50 top-full mt-1 left-0 w-[420px] '
              'rounded-lg border bg-popover p-2 text-popover-foreground shadow-md">'
              '<div class="grid grid-cols-3 gap-1">' + items + "</div></div>")
    nav_parts.append(
        '<li class="relative group">'
        '<a href="' + esc(url) + '" class="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors'
        + active + '">' + html.escape(name) + "</a>" + dd + "</li>")
nav_html = "\n".join(nav_parts)

hero = hot[0]

flash_parts = []
for i, n in enumerate(news[:7]):
    flash_parts.append(
        '<a href="' + esc(n["url"]) + '" class="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent hover:text-accent-foreground">'
        '<span class="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">'
        + str(i + 1) + '</span><span class="text-[13px] leading-snug">' + html.escape(n["title"]) + "</span></a>")
flash_html = "\n".join(flash_parts)

feat = reviews[0]
rest = reviews[1:4]
feat_html = (
    '<div class="group relative overflow-hidden rounded-xl border">'
    '<img src="' + esc(feat["image"] or "") + '" class="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105" alt="">'
    '<span class="absolute right-3 top-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold '
    'bg-background/85 text-foreground backdrop-blur">' + html.escape(feat["category"]) + "</span>"
    '<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-14">'
    '<a href="' + esc(feat["url"]) + '" class="text-lg font-semibold text-white hover:underline">' + html.escape(feat["title"]) + "</a>"
    '<div class="mt-2 flex items-center gap-4 text-xs text-white/80">'
    '<span>' + html.escape(feat["date"]) + '</span><span>👁 ' + str(feat["views"]) + '</span><span>💬 ' + str(feat["replies"]) + "</span>"
    '<span class="ml-auto font-semibold text-white">阅读全文 →</span></div></div></div>')

rest_parts = []
for r in rest:
    rest_parts.append(
        '<a class="group flex gap-4 rounded-xl border p-3 transition-colors hover:bg-accent/50" href="' + esc(r["url"]) + '">'
        '<img src="' + esc(r["image"] or "") + '" class="h-20 w-28 flex-none rounded-lg object-cover" loading="lazy" alt="">'
        '<div class="flex min-w-0 flex-col justify-center">'
        '<div class="truncate text-sm font-semibold">' + html.escape(r["title"]) + "</div>"
        '<div class="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">'
        "<span>" + html.escape(r["category"]) + "</span><span>" + html.escape(r["date"]) + "</span><span>💬 " + str(r["replies"]) + "</span>"
        "</div></div></a>")
rest_html = "\n".join(rest_parts)

def links(items):
    out = []
    for x in items:
        out.append('<a href="' + esc(x["url"]) + '" class="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:shadow-sm">'
                   + html.escape(x["title"]) + "</a>")
    return "\n".join(out)

COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#14b8a6"]
pulse_parts = []
for i, t in enumerate(threads):
    color = COLORS[i % len(COLORS)]
    pulse_parts.append(
        '<a href="' + esc(t["url"]) + '" class="group block rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">'
        '<div class="flex items-center gap-3">'
        '<span class="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full">'
        '<span class="flex h-full w-full items-center justify-center rounded-full text-white text-[13px] font-semibold" style="background:'
        + color + '">' + html.escape(t["author"]["name"][0]) + "</span></span>"
        '<span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold">' + html.escape(t["title"]) + "</span>"
        '<span class="block text-xs text-muted-foreground">' + html.escape(t["author"]["name"]) + " · " + html.escape(t["lastPostTime"] or "") + "</span></span>"
        '<span class="flex flex-none items-center gap-4 text-xs text-muted-foreground"><span>💬 ' + str(t["replies"] or 0)
        + "</span><span>👁 " + str(t["views"] or 0) + "</span></span></div></a>")
pulse_html = "\n".join(pulse_parts)

cats_parts = []
for c in cats:
    chips = "".join(
        '<a href="' + esc(f2["url"]) + '" class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">'
        + html.escape(f2["name"]) + "</a>" for f2 in c["forums"][:8])
    cats_parts.append(
        "<div><h4 class='mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>"
        + html.escape(c["name"]) + "</h4><div class='flex flex-wrap gap-1.5'>" + chips + "</div></div>")
cats_html = "\n".join(cats_parts)

hero_img = esc(hero["image"] or "")
hero_title = html.escape(hero["title"])
news_n = str(len(news))

TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Chiphell — 发现</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        primary: { DEFAULT: "oklch(var(--primary) / <alpha-value>)", foreground: "oklch(var(--primary-fg) / <alpha-value>)" },
        secondary: { DEFAULT: "oklch(var(--secondary) / <alpha-value>)", foreground: "oklch(var(--secondary-fg) / <alpha-value>)" },
        muted: { DEFAULT: "oklch(var(--muted) / <alpha-value>)", foreground: "oklch(var(--muted-foreground) / <alpha-value>)" },
        accent: { DEFAULT: "oklch(var(--accent) / <alpha-value>)", foreground: "oklch(var(--accent-fg) / <alpha-value>)" },
        popover: { DEFAULT: "oklch(var(--popover) / <alpha-value>)", foreground: "oklch(var(--popover-fg) / <alpha-value>)" },
        card: { DEFAULT: "oklch(var(--card) / <alpha-value>)", foreground: "oklch(var(--card-fg) / <alpha-value>)" },
      },
      borderRadius: { xl: "calc(var(--radius) + 4px)", lg: "var(--radius)", md: "calc(var(--radius) - 2px)" },
    },
  },
};
</script>
<style>
  :root {
    --background: 98.5% 0.002 250; --foreground: 18% 0.012 250;
    --card: 100% 0 0; --card-fg: 18% 0.012 250;
    --popover: 100% 0 0; --popover-fg: 18% 0.012 250;
    --primary: 55% 0.2 262; --primary-fg: 100% 0 0;
    --secondary: 96% 0.005 250; --secondary-fg: 24% 0.012 250;
    --muted: 96% 0.005 250; --muted-foreground: 52% 0.012 250;
    --accent: 96% 0.008 250; --accent-fg: 24% 0.012 250;
    --border: 90% 0.006 250; --input: 90% 0.006 250; --ring: 55% 0.2 262;
    --radius: 10px;
  }
  html.dark {
    --background: 14% 0.012 255; --foreground: 97% 0.002 250;
    --card: 18.5% 0.014 255; --card-fg: 97% 0.002 250;
    --popover: 18.5% 0.014 255; --popover-fg: 97% 0.002 250;
    --primary: 66% 0.17 262; --primary-fg: 14% 0.012 255;
    --secondary: 25% 0.012 255; --secondary-fg: 97% 0.002 250;
    --muted: 24% 0.012 255; --muted-foreground: 70% 0.01 250;
    --accent: 25% 0.014 255; --accent-fg: 97% 0.002 250;
    --border: 28% 0.012 255; --input: 28% 0.012 255; --ring: 66% 0.17 262;
  }
  body { background: var(--background); color: var(--foreground); }
  .shadow-card { box-shadow: 0 1px 3px rgb(0 0 0 / .07), 0 8px 24px -12px rgb(0 0 0 / .12); }
  .rounded-xl { box-shadow: 0 1px 3px rgb(0 0 0 / .06), 0 10px 28px -16px rgb(0 0 0 / .14); }
</style>
</head>
<body class="bg-background text-foreground">

<header class="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
  <div class="mx-auto flex h-14 max-w-[1440px] items-center gap-1.5 px-3">
    <a href="#" class="mr-2 flex items-center gap-2 text-base font-extrabold tracking-tight">
      <span class="flex h-7 w-7 items-center justify-center rounded-lg text-[7px] font-extrabold leading-none
        bg-gradient-to-br from-red-600 to-red-800 text-white">chip<br>hell</span>Chiphell</a>
    <ul class="flex min-w-0 flex-1 items-center gap-0.5">__NAV__</ul>
    <div class="relative ml-2 hidden md:block">
      <svg class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
      <input placeholder="搜索帖子、版块…" class="h-8 w-36 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
    <button onclick="document.documentElement.classList.toggle('dark')"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input transition-colors hover:bg-accent">◐</button>
    <button class="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90">发帖</button>
  </div>
</header>

<main class="mx-auto max-w-[1440px] px-4 py-6">

  <div class="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="group relative overflow-hidden rounded-xl border shadow-sm">
      <img src="__HERO_IMG__" class="h-[420px] w-full object-cover transition-transform duration-700 group-hover:scale-105" alt="">
      <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"></div>
      <span class="absolute left-5 top-5 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-fg">今日焦点</span>
      <div class="absolute inset-x-5 bottom-5 text-xl font-bold text-white drop-shadow">__HERO_TITLE__</div>
    </div>
    <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div class="flex items-center justify-between p-5 pb-3">
        <h3 class="flex items-center gap-2 text-sm font-bold">
          <span class="h-2 w-2 rounded-full bg-primary"></span>快讯
          <span class="text-xs font-normal text-muted-foreground">今日 __NEWS_N__ 条</span></h3>
        <a href="#" class="text-xs text-muted-foreground hover:text-primary">全部 →</a>
      </div>
      <div class="flex flex-col px-2 pb-3">__FLASH__</div>
    </div>
  </div>

  <section class="mb-6">
    <div class="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div class="flex items-center justify-between p-5 pb-4">
        <div class="flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h16M12 4v16"/></svg>
          </span>
          <div>
            <h3 class="text-base font-bold leading-tight">CHH评测室</h3>
            <p class="text-xs text-muted-foreground">深度 · 专业 · 首发</p>
          </div>
        </div>
        <a href="#" class="text-xs font-medium text-muted-foreground hover:text-primary">全部评测 →</a>
      </div>
      <div class="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        __FEAT__
        <div class="flex flex-col gap-3">__REST__</div>
      </div>
    </div>
  </section>

  <div class="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
        <h3 class="text-sm font-bold">文化</h3>
        <a href="#" class="ml-auto text-xs text-muted-foreground hover:text-primary">更多 →</a>
      </div>
      <div class="flex flex-col">__CULTURE__</div>
    </div>
    <div class="rounded-xl border bg-card p-5 shadow-sm">
      <div class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
        <h3 class="text-sm font-bold">专题</h3>
        <a href="#" class="ml-auto text-xs text-muted-foreground hover:text-primary">更多 →</a>
      </div>
      <div class="flex flex-col">__TOPICS__</div>
    </div>
  </div>

  <section class="mb-6">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="flex items-center gap-2.5 text-base font-bold">
        <span class="h-2 w-2 rounded-full bg-primary"></span>社区脉搏
        <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></span>实时</span>
      </h2>
      <a href="#" class="text-xs font-medium text-muted-foreground hover:text-primary">进入论坛 →</a>
    </div>
    <div class="grid grid-cols-1 gap-3 rounded-xl border bg-muted/40 p-3 sm:grid-cols-2">__PULSE__</div>
    </div>
  </section>

  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2 class="flex items-center gap-2.5 text-base font-bold">
        <span class="h-2 w-2 rounded-full bg-primary"></span>版块速览</h2>
      <a href="#" class="text-xs font-medium text-muted-foreground hover:text-primary">全部版块 →</a>
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">__CATS__</div>
  </section>

</main>

<footer class="mx-auto max-w-[1440px] px-4 pb-10 text-xs text-muted-foreground">
  Chiphell · remakeweb Spectrum 重绘 v5 — shadcn 组件 DOM 直用
</footer>

</body>
</html>"""

out = TEMPLATE
out = out.replace("__NAV__", nav_html)
out = out.replace("__HERO_IMG__", hero_img := esc(hero["image"] or ""))
out = out.replace("__HERO_TITLE__", html.escape(hero["title"]))
out = out.replace("__NEWS_N__", str(len(news)))
out = out.replace("__FLASH__", flash_html)
out = out.replace("__FEAT__", feat_html)
out = out.replace("__REST__", rest_html)
out = out.replace("__CULTURE__", links(portal["culture"][:5]))
out = out.replace("__TOPICS__", links(portal["topics"][:5]))
out = out.replace("__PULSE__", pulse_html)
out = out.replace("__CATS__", cats_html)

OUT.write_text(out, encoding="utf-8")
print("生成:", OUT, f"({OUT.stat().st_size//1024}KB)")
