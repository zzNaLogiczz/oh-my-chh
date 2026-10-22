#!/usr/bin/env python3
"""remakeweb：Spectrum 重绘首页预览生成器（真实解析数据 → 静态 HTML）"""
import json, re, html
from pathlib import Path

ROOT = Path("/Users/zznalogic/projects/chh/oh-my-chh")
DATA = ROOT / ".omx/remake-data"
OUT = ROOT / ".omx/spectrum-review/remake-home.html"

portal = json.load(open(DATA / "portal-home.json", encoding="utf-8"))
forum = json.load(open(DATA / "forum-index.json", encoding="utf-8"))
threads = json.load(open(DATA / "thread-list.json", encoding="utf-8"))

def esc(s): return html.escape(s or "", quote=True)

def clean_review(t):
    """评测标题混入了 日期/浏览/回复/分类 → 拆开"""
    m = re.match(r"(.*?)\s+(20\d{2}-\d{2}-\d{2})\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*)", t or "")
    if m:
        return {"title": m.group(1), "date": m.group(2), "views": int(m.group(3)),
                "replies": int(m.group(4)), "category": m.group(5)}
    return {"title": t, "date": "", "views": None, "replies": None, "category": ""}

hot = portal["hot"]
news = portal["news"]
reviews = [clean_review(r["title"]) | {"url": r["url"], "image": r["image"]} for r in portal["reviews"]]
culture = portal["culture"][:6]
topics = portal["topics"][:6]
cats = [c for c in forum["categories"] if c["forums"]]
threads = [t for t in threads["threads"] if not t["pinned"]][:8]

def chip(cat):
    return f'<span class="cat-chip">{esc(cat)}</span>' if cat else ""

reviews_html = "\n".join(
    f'''<a class="card review" href="{esc(r["url"])}">
      <div class="review-media"><img src="{esc(r["image"] or "")}" loading="lazy" alt="">
      {chip(r["category"])}</div>
      <div class="review-body">
        <div class="review-title">{esc(r["title"])}</div>
        <div class="review-meta"><span>{esc(r["date"])}</span><span>👁 {r["views"] or 0}</span><span>💬 {r["replies"] or 0}</span></div>
      </div>
    </a>''' for r in reviews[:6])

news_html = "\n".join(
    f'<a class="news-row" href="{esc(n["url"])}"><span class="news-idx">{i+1}</span><span class="news-t">{esc(n["title"])}</span></a>'
    for i, n in enumerate(news[:10]))

hot_dots = "\n".join(f'<span class="dot{" active" if i==0 else ""}"></span>' for i in range(len(hot)))

threads_html = "\n".join(
    f'''<a class="thread-row" href="{esc(t["url"])}">
      <div class="thread-main">
        <div class="thread-t">{esc(t["title"])}</div>
        <div class="thread-meta"><span>{esc(t["author"]["name"])}</span><span>{esc(t["lastPostTime"] or "")}</span></div>
      </div>
      <div class="thread-stats"><span>💬 {t["replies"] or 0}</span><span>👁 {t["views"] or 0}</span></div>
    </a>''' for t in threads)

cats_html = "\n".join(
    f'''<div class="cat-group"><div class="cat-name">{esc(c["name"])}</div>
    <div class="cat-forums">{''.join(f'<a class="forum-chip" href="{esc(f2["url"])}">{esc(f2["name"])}</a>' for f2 in c["forums"][:6])}</div></div>'''
    for c in cats)

culture_html = "\n".join(f'<a class="mini-link" href="{esc(x["url"])}">{esc(x["title"])}</a>' for x in culture)
topics_html = "\n".join(f'<a class="mini-link" href="{esc(x["url"])}">{esc(x["title"])}</a>' for x in topics)

html_doc = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Chiphell · Spectrum 重绘首页</title>
<style>
  :root {{
    --bg: oklch(98.5% 0.002 250); --surface: oklch(100% 0 0);
    --fg: oklch(18% 0.012 250); --muted: oklch(54% 0.012 250);
    --border: oklch(92% 0.005 250); --primary: oklch(58% 0.18 255);
    --primary-fg: oklch(100% 0 0); --primary-soft: oklch(58% 0.18 255 / .1);
    --r: 12px; --r-lg: 16px;
    --shadow-sm: 0 1px 2px oklch(20% 0.02 255 / .05);
    --shadow-md: 0 1px 3px oklch(20% 0.02 255 / .06), 0 6px 18px oklch(20% 0.02 255 / .07);
  }}
  html.dark {{
    --bg: oklch(16% 0.014 255); --surface: oklch(20% 0.016 255);
    --fg: oklch(96% 0.002 250); --muted: oklch(70% 0.01 250);
    --border: oklch(30% 0.014 255); --primary: oklch(68% 0.16 255);
    --primary-soft: oklch(68% 0.16 255 / .16);
    --shadow-md: 0 1px 3px oklch(0 0 0 / .4), 0 8px 24px oklch(0 0 0 / .4);
  }}
  * {{ box-sizing: border-box; margin: 0; }}
  body {{
    background: var(--bg); color: var(--fg);
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  }}
  a {{ color: inherit; text-decoration: none; }}
  img {{ display: block; }}

  /* ===== 顶栏 ===== */
  .topbar {{
    position: sticky; top: 0; z-index: 50;
    background: color-mix(in oklch, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
  }}
  .topbar-in {{ max-width: 1280px; margin: 0 auto; display: flex; align-items: center; gap: 20px; padding: 10px 20px; }}
  .logo {{ display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 800; letter-spacing: .2px; }}
  .logo-mark {{ width: 34px; height: 34px; border-radius: 9px; background: oklch(52% 0.19 27); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; line-height: 1.05; text-align: center; }}
  .topnav {{ display: flex; gap: 2px; }}
  .topnav a {{ padding: 7px 13px; border-radius: 9px; font-weight: 500; color: var(--muted); }}
  .topnav a:hover {{ background: var(--primary-soft); color: var(--primary); }}
  .topnav a.active {{ background: var(--primary-soft); color: var(--primary); font-weight: 600; }}
  .spacer {{ flex: 1; }}
  .search {{ position: relative; }}
  .search svg {{ position: absolute; left: 11px; top: 9px; width: 15px; height: 15px; color: var(--muted); }}
  .search input {{
    width: 210px; height: 34px; padding: 0 12px 0 34px;
    border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--fg); font-size: 13px; outline: none;
  }}
  .search input:focus {{ border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 22%, transparent); }}
  .btn-primary {{
    display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 15px;
    border-radius: 10px; border: 0; background: var(--primary); color: var(--primary-fg);
    font-size: 13px; font-weight: 600; cursor: pointer;
  }}
  .btn-primary:hover {{ filter: brightness(1.08); }}
  .theme-btn {{
    width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--surface); color: var(--fg); cursor: pointer; font-size: 15px;
  }}

  /* ===== 布局 ===== */
  .page {{ max-width: 1280px; margin: 0 auto; padding: 18px 20px 60px; display: flex; flex-direction: column; gap: 22px; }}
  .grid-hero {{ display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 22px; }}
  @media (max-width: 1000px) {{ .grid-hero {{ grid-template-columns: 1fr; }} }}

  .panel {{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); }}
  .sec-head {{ display: flex; align-items: center; gap: 8px; padding: 14px 16px 0; }}
  .sec-dot {{ width: 7px; height: 7px; border-radius: 50%; background: var(--primary); }}
  .sec-title {{ font-size: 15px; font-weight: 700; }}
  .sec-more {{ margin-left: auto; font-size: 12px; color: var(--muted); }}
  .sec-more:hover {{ color: var(--primary); }}

  /* 热门轮播 */
  .hero {{ position: relative; overflow: hidden; border-radius: var(--r-lg); }}
  .hero img {{ width: 100%; height: 380px; object-fit: cover; }}
  .hero-cap {{
    position: absolute; left: 18px; bottom: 16px; max-width: 80%;
    padding: 9px 16px; border-radius: 12px;
    background: oklch(22% 0.02 255 / .88); color: oklch(98% 0.004 250);
    font-size: 15px; font-weight: 600;
  }}
  .hero-dots {{ position: absolute; left: 18px; bottom: -34px; display: flex; gap: 6px; }}

  /* 快讯 */
  .news-list {{ padding: 10px 14px 14px; display: flex; flex-direction: column; }}
  .news-row {{ display: flex; gap: 10px; align-items: baseline; padding: 8px 10px; border-radius: 9px; }}
  .news-row:hover {{ background: var(--primary-soft); }}
  .news-idx {{ width: 18px; flex: none; text-align: center; font-weight: 700; font-size: 13px; color: var(--primary); }}
  .news-row:nth-child(n+7) .news-idx {{ color: var(--muted); }}
  .news-t {{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}

  /* 评测卡片 */
  .review-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 14px 16px 16px; }}
  @media (max-width: 1000px) {{ .review-grid {{ grid-template-columns: repeat(2, 1fr); }} }}
  .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; transition: transform .15s, box-shadow .15s; }}
  .card:hover {{ transform: translateY(-3px); box-shadow: var(--shadow-md); }}
  .review-media {{ position: relative; }}
  .review-media img {{ width: 100%; height: 170px; object-fit: cover; }}
  .cat-chip {{
    position: absolute; right: 10px; top: 10px; padding: 3px 10px;
    border-radius: 999px; background: oklch(22% 0.02 255 / .85); color: oklch(98% 0.004 250);
    font-size: 11px; font-weight: 600;
  }}
  .review-body {{ padding: 12px 14px 14px; }}
  .review-title {{ font-weight: 650; font-size: 14px; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
  .review-meta {{ display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--muted); }}

  /* 文化/专题 */
  .pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }}
  .mini-list {{ padding: 8px 12px 12px; display: flex; flex-direction: column; }}
  .mini-link {{ padding: 9px 10px; border-radius: 9px; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .mini-link:hover {{ background: var(--primary-soft); color: var(--primary); }}

  /* 最新主题 */
  .threads {{ display: flex; flex-direction: column; padding: 6px 10px 10px; }}
  .thread-row {{ display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 11px; }}
  .thread-row:hover {{ background: var(--primary-soft); }}
  .thread-main {{ flex: 1; min-width: 0; }}
  .thread-t {{ font-weight: 550; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .thread-meta {{ display: flex; gap: 12px; font-size: 12px; color: var(--muted); margin-top: 2px; }}
  .thread-stats {{ display: flex; gap: 14px; font-size: 12px; color: var(--muted); flex: none; }}

  /* 版块速览 */
  .cat-groups {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 22px; padding: 10px 16px 16px; }}
  .cat-group {{ padding: 4px 0; }}
  .cat-name {{ font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px; }}
  .cat-forums {{ display: flex; flex-wrap: wrap; gap: 6px; }}
  .forum-chip {{
    padding: 4px 12px; border: 1px solid var(--border); border-radius: 999px;
    font-size: 12.5px; color: var(--fg); background: var(--surface);
  }}
  .forum-chip:hover {{ border-color: var(--primary); color: var(--primary); }}

  footer {{ max-width: 1280px; margin: 0 auto; padding: 0 20px 40px; font-size: 12px; color: var(--muted); }}
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-in">
    <a class="logo" href="#"><span class="logo-mark">chip<br>hell</span>Chiphell</a>
    <nav class="topnav">
      <a class="active" href="#">首页</a>
      <a href="#">评测</a>
      <a href="#">社区</a>
      <a href="#">排行榜</a>
    </nav>
    <div class="spacer"></div>
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
      <input placeholder="搜索帖子、版块…">
    </div>
    <button class="theme-btn" onclick="document.documentElement.classList.toggle('dark')" title="切换明暗">◐</button>
    <a class="btn-primary" href="#">发帖</a>
  </div>
</header>

<div class="page">

  <div class="grid-hero">
    <section class="panel hero">
      <img src="{esc(hot[0]["image"] or "")}" alt="">
      <div class="hero-cap">{esc(hot[0]["title"])}</div>
      <div class="hero-dots">{hot_dots}</div>
    </section>
    <section class="panel">
      <div class="sec-head"><span class="sec-dot"></span><span class="sec-title">快讯</span><a class="sec-more" href="#">更多 →</a></div>
      <div class="news-list">{news_html}</div>
    </section>
  </div>

  <section class="panel">
    <div class="sec-head"><span class="sec-dot"></span><span class="sec-title">CHH评测室</span><a class="sec-more" href="#">全部评测 →</a></div>
    <div class="review-grid">{reviews_html}</div>
  </section>

  <div class="pair">
    <section class="panel">
      <div class="sec-head"><span class="sec-dot"></span><span class="sec-title">文化</span></div>
      <div class="mini-list">{culture_html}</div>
    </section>
    <section class="panel">
      <div class="sec-head"><span class="sec-dot"></span><span class="sec-title">专题</span></div>
      <div class="mini-list">{topics_html}</div>
    </section>
  </div>

  <section class="panel">
    <div class="sec-head"><span class="sec-dot"></span><span class="sec-title">最新主题</span><a class="sec-more" href="#">进入论坛 →</a></div>
    <div class="threads">{threads_html}</div>
  </section>

  <section class="panel">
    <div class="sec-head"><span class="sec-dot"></span><span class="sec-title">版块速览</span></div>
    <div class="cat-groups">{cats_html}</div>
  </section>

</div>

<footer>Chiphell · Spectrum 重绘演示 — 数据来自实时页面解析</footer>
</body>
</html>'''

OUT.write_text(html_doc, encoding="utf-8")
print("生成:", OUT, f"({OUT.stat().st_size//1024}KB)")
