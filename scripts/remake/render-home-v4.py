#!/usr/bin/env python3
"""remakeweb v4：编辑部杂志式首页（全频道导航 + 下拉二级分类 + bento 特写）"""
import json, re, html
from pathlib import Path

ROOT = Path("/Users/zznalogic/projects/chh/oh-my-chh")
DATA = ROOT / ".omx/remake-data"
OUT = ROOT / ".omx/spectrum-review/remake-home-v4.html"

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
cats = [c for c in forum["categories"] if c["forums"]]

# 真实频道导航（chiphell 原始导航结构）+ 二级分类
NAV = [
    ("首页", "/", None),
    ("评测", "/portal.php?mod=list&catid=1", None),
    ("电脑", "/forum.php?mod=forumdisplay&fid=2", ["视频评测", "笔记本", "机箱", "处理器", "散热器", "主板", "内存", "显卡", "显示设备", "外设", "电源", "存储", "台式机"]),
    ("掌设", "/forum.php?mod=forumdisplay&fid=36", ["智能手机", "平板", "智能穿戴"]),
    ("摄影", "/forum.php?mod=forumdisplay&fid=31", ["微单", "单反", "旁轴", "菲林", "镜头", "摄像"]),
    ("照片", "/forum.php?mod=forumdrop&fid=3", ["人物肖像", "风景游记", "静物", "人文扫街", "动物植物"]),
    ("汽车", "/forum.php?mod=forumdisplay&fid=32", ["买菜车", "性能车", "SUV", "MPV", "摩托轻骑", "改装配件"]),
    ("单车", "/forum.php?mod=forumdisplay&fid=29", ["公路车", "山地车", "折叠车", "休旅车"]),
    ("模型", "/forum.php?mod=forumdisplay&fid=30", ["人偶手办", "比例成品", "拼装", "RC遥控"]),
    ("败家", "/forum.php?mod=forumdisplay&fid=33", ["开箱", "收纳", "体验分享"]),
    ("时尚", "/forum.php?mod=forumdisplay&fid=118", ["鞋类服饰", "箱包"]),
    ("腕表", "/forum.php?mod=forumdisplay&fid=125", ["机械表", "电子表"]),
    ("视听", "/forum.php?mod=forumdisplay&fid=66", ["耳机耳放", "音箱功放", "解码转盘", "随身设备"]),
    ("美食", "/forum.php?mod=forumdisplay&fid=67", ["当地美食", "世界美食", "美食器材"]),
    ("家居", "/forum.php?mod=forumdisplay&fid=132", ["品质生活"]),
    ("活宠", "/forum.php?mod=forumdisplay&fid=133", ["育儿分享"]),
    ("文化", "/forum.php?mod=forumdisplay&fid=37", ["读书", "影音"]),
    ("社区", "/forum.php", None),
]
nav_html = []
for name, url, subs in NAV:
    active = ' class="on"' if name == "首页" else ""
    dd = ""
    if subs:
        items = "".join(f'<a href="#">{esc(s)}</a>' for s in subs)
        dd = f'<div class="dropdown"><div class="dd-grid">{items}</div></div>'
    nav_html.append(f'<li class="has-dd"{active}><a href="{esc(url)}">{esc(name)}</a>{dd}</li>')
nav_html = "\n".join(nav_html)

# 焦点区
hero = hot[0]
hero_sub = [h for h in hot[1:3]]

# 评测：第一张大特写 + 其余紧凑
feat = reviews[0]
rest = reviews[1:5]

news_html = "\n".join(
    f'<a class="flash" href="{esc(n["url"])}"><span class="ft">{esc(n["title"])}</span></a>'
    for n in news[:7])

feat_html = f'''
<a class="feat" href="{esc(feat["url"])}">
  <div class="feat-media"><img src="{esc(feat["image"] or "")}" alt=""><span class="rcat">{esc(feat["category"])}</span></div>
  <div class="feat-body">
    <div class="feat-title">{esc(feat["title"])}</div>
    <div class="feat-meta"><span>{esc(feat["date"])}</span><span>👁 {feat["views"]}</span><span>💬 {feat["replies"]}</span><span class="feat-more">阅读全文 →</span></div>
  </div>
</a>'''
rest_html = "\n".join(
    f'''<a class="rcard" href="{esc(r["url"])}">
      <div class="rmedia"><img src="{esc(r["image"] or "")}" loading="lazy" alt=""><span class="rcat">{esc(r["category"])}</span></div>
      <div class="rbody"><div class="rtitle">{esc(r["title"])}</div>
      <div class="rmeta"><span>{esc(r["date"])}</span><span>👁 {r["views"] or 0}</span><span>💬 {r["replies"] or 0}</span></div></div></a>'''
    for r in rest[:3])

culture_html = "\n".join(f'<a class="mlink" href="{esc(x["url"])}"><span class="mt">{esc(x["title"])}</span><svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></a>' for x in portal["culture"][:5])
topics_html = "\n".join(f'<a class="mlink" href="{esc(x["url"])}"><span class="mt">{esc(x["title"])}</span><svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></a>' for x in portal["topics"][:5])

threads_html = "\n".join(
    f'''<a class="pulse-row" href="{esc(t["url"])}">
      <div class="pav" style="background:{['#6366f1','#0ea5e9','#f59e0b','#10b981','#ef4444','#8b5cf6','#14b8a6'][i % 7]}">{esc(t["author"]["name"][0])}</div>
      <div class="pmain"><div class="ptitle">{esc(t["title"])}</div>
      <div class="pmeta">{esc(t["author"]["name"])} · {esc(t["lastPostTime"] or "")}</div></div>
      <div class="pstats"><span>💬 {t["replies"] or 0}</span><span>👁 {t["views"] or 0}</span></div></a>'''
    for i, t in enumerate(threads))

cats_html = "\n".join(
    f'<div class="catgroup"><div class="catname">{esc(c["name"])}</div>'
    f'<div class="catchips">' + "".join(f'<a class="chip" href="{esc(f2["url"])}">{esc(f2["name"])}</a>' for f2 in c["forums"][:8]) + '</div></div>'
    for c in cats)

CSS = """
  :root {
    --bg: oklch(97.5% 0.003 250); --surface: oklch(100% 0 0);
    --fg: oklch(18% 0.015 250); --muted: oklch(52% 0.012 250);
    --border: oklch(90% 0.006 250);
    --primary: oklch(52% 0.2 262); --primary-fg: oklch(100% 0 0);
    --tint: oklch(95% 0.015 260);
    --r: 18px; --r-sm: 12px;
  }
  html.dark {
    --bg: oklch(13% 0.012 255); --surface: oklch(18.5% 0.014 255);
    --fg: oklch(96% 0.002 250); --muted: oklch(66% 0.01 250);
    --border: oklch(27% 0.012 255); --primary: oklch(68% 0.16 262);
    --tint: oklch(23% 0.02 262);
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); color: var(--fg);
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif; }
  a { color: inherit; text-decoration: none; }
  img { display: block; }

  /* ===== 顶栏：全频道 + 下拉二级 ===== */
  .topbar { position: sticky; top: 0; z-index: 100; backdrop-filter: blur(14px);
    background: color-mix(in oklch, var(--bg) 80%, transparent); border-bottom: 1px solid var(--border); }
  .tin { max-width: 1400px; margin: 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 16px; }
  .logo { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; margin-right: 6px; }
  .logomark { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, oklch(52% 0.19 27), oklch(42% 0.17 20));
    color: #fff; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; line-height: 1.05; text-align: center; }
  .nav { display: flex; align-items: center; gap: 1px; flex: 1; min-width: 0; }
  .nav > li { position: relative; list-style: none; }
  .nav > li > a { display: block; padding: 7px 11px; border-radius: 9px; font-size: 13.5px; font-weight: 550;
    color: var(--fg); white-space: nowrap; transition: background .12s, color .12s; }
  .nav > li > a:hover { background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); }
  .nav > li.on > a { background: var(--primary); color: var(--primary-fg); font-weight: 650; }
  .dropdown { display: none; position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
    width: max-content; max-width: 560px; padding: 10px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    box-shadow: 0 20px 50px -12px oklch(20% 0.03 255 / .35); }
  .nav > li:hover .dropdown { display: block; }
  .nav > li:hover > a::after { content: ""; }
  .dd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .dd-grid a { padding: 7px 12px; border-radius: 8px; font-size: 13px; color: var(--fg); white-space: nowrap; }
  .dd-grid a:hover { background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); }
  .sp { flex: 1; }
  .search { position: relative; }
  .search svg { position: absolute; left: 11px; top: 9px; width: 14px; height: 14px; color: var(--muted); }
  .search input { width: 170px; height: 34px; padding: 0 12px 0 32px; border: 1px solid var(--border);
    border-radius: 10px; background: var(--surface); color: var(--fg); font-size: 13px; outline: none; }
  .search input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent); }
  .cta { height: 34px; padding: 0 15px; border-radius: 10px; border: 0; background: var(--primary);
    color: var(--primary-fg); font-size: 13px; font-weight: 650; cursor: pointer; }
  .cta.ghost2 { width: 34px; padding: 0; background: var(--surface); color: var(--fg); border: 1px solid var(--border); }

  /* ===== 页面 ===== */
  .page { max-width: 1400px; margin: 0 auto; padding: 24px 16px 80px; display: flex; flex-direction: column; gap: 44px; }

  /* 区间标题：编辑式编号 */
  .sec { display: flex; align-items: baseline; gap: 14px; margin-bottom: 20px; }
  .sec .idx { font-size: 26px; font-weight: 800; font-style: italic; color: color-mix(in oklch, var(--primary) 45%, transparent);
    font-family: ui-monospace, monospace; letter-spacing: -1px; }
  .sec .st { font-size: 21px; font-weight: 750; letter-spacing: -0.3px; }
  .sec .ss { color: var(--muted); font-size: 13px; }
  .sec .more { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--primary); }

  /* ===== HERO：焦点大图 + 快讯侧栏 ===== */
  .hero-band { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; }
  @media (max-width: 1080px) { .hero-band { grid-template-columns: 1fr; } }
  .hero { position: relative; border-radius: var(--r); overflow: hidden; min-height: 480px;
    box-shadow: 0 30px 70px -20px oklch(30% 0.05 260 / .5); }
  .hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 6s ease; }
  .hero:hover img { transform: scale(1.04); }
  .hero-shade { position: absolute; inset: 0; background: linear-gradient(185deg, transparent 30%, oklch(14% 0.02 255 / .9) 88%); }
  .hero-cap { position: absolute; left: 26px; right: 26px; bottom: 22px; }
  .hero-tag { display: inline-block; padding: 4px 13px; border-radius: 999px; background: var(--primary);
    color: var(--primary-fg); font-size: 11.5px; font-weight: 700; margin-bottom: 12px; }
  .hero-t { color: #fff; font-size: 27px; font-weight: 780; letter-spacing: -0.4px; line-height: 1.3;
    text-shadow: 0 2px 14px rgb(0 0 0 / .4);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  .flashpanel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r);
    padding: 18px 18px 14px; display: flex; flex-direction: column; }
  .fp-head { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
  .fp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent); }
  .fp-t { font-size: 15px; font-weight: 750; }
  .fp-n { margin-left: auto; font-size: 12px; color: var(--muted); }
  .flash { display: flex; gap: 10px; padding: 10px 8px; border-radius: 10px; align-items: baseline; }
  .flash:hover { background: color-mix(in oklch, var(--primary) 7%, transparent); }
  .flash .fi { color: var(--primary); font-weight: 700; font-size: 13px; flex: none; width: 16px; }
  .flash .ft { font-size: 13.5px; line-height: 1.5;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  /* ===== 01 评测室：特写 + 紧凑 ===== */
  .review-bento { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(2, minmax(0, 1fr)); gap: 18px; }
  @media (max-width: 1080px) { .review-bento { grid-template-columns: 1fr; } }
  .feat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden;
    transition: transform .16s, box-shadow .16s; }
  .feat:hover { transform: translateY(-3px); box-shadow: 0 22px 48px -16px oklch(30% 0.05 260 / .4); }
  .feat-media { position: relative; }
  .feat-media img { width: 100%; height: 320px; object-fit: cover; }
  .rcat { position: absolute; right: 12px; top: 12px; padding: 4px 12px; border-radius: 999px;
    background: oklch(20% 0.02 255 / .82); color: oklch(98% 0.004 250); font-size: 11px; font-weight: 650; }
  .feat-body { padding: 18px 20px 20px; }
  .feat-title { font-size: 19px; font-weight: 750; line-height: 1.4; letter-spacing: -0.2px; }
  .feat-meta { display: flex; gap: 14px; margin-top: 10px; font-size: 12.5px; color: var(--muted); }
  .feat-more { margin-left: auto; color: var(--primary); font-weight: 650; }
  .rcol { display: flex; flex-direction: column; gap: 16px; }
  .rcard { flex: 1; display: flex; gap: 14px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); overflow: hidden; transition: transform .16s, box-shadow .16s; }
  .rcard:hover { transform: translateY(-2px); box-shadow: 0 14px 32px -14px oklch(30% 0.05 260 / .35); }
  .rcard .rmedia { flex: none; width: 148px; }
  .rcard .rmedia img { width: 100%; height: 100%; min-height: 110px; object-fit: cover; }
  .rcard .rbody { padding: 14px 14px 12px 0; display: flex; flex-direction: column; justify-content: center; }
  .rtitle { font-weight: 650; font-size: 14px; line-height: 1.45; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .rmeta { display: flex; gap: 9px; margin-top: 7px; font-size: 12px; color: var(--muted); }

  /* ===== 02 文化/专题 双色面板 ===== */
  .duo { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  @media (max-width: 900px) { .duo { grid-template-columns: 1fr; } }
  .zone { border-radius: var(--r); padding: 22px 22px 18px; }
  .zone.violet { background: linear-gradient(165deg, oklch(94% 0.03 300), oklch(96% 0.015 260));
    border: 1px solid color-mix(in oklch, oklch(48% 0.16 300) 18%, var(--border)); }
  html.dark .zone.violet { background: linear-gradient(165deg, oklch(23% 0.035 300), oklch(19% 0.02 262)); }
  .zone.amber { background: linear-gradient(165deg, oklch(95% 0.045 75), oklch(96% 0.02 260));
    border: 1px solid color-mix(in oklch, oklch(50% 0.12 70) 18%, var(--border)); }
  html.dark .zone.amber { background: linear-gradient(165deg, oklch(24% 0.03 75), oklch(19% 0.02 262)); }
  .zhead { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .zico { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .zone.violet .zico { background: color-mix(in oklch, oklch(48% 0.16 300) 16%, transparent); color: oklch(48% 0.16 300); }
  html.dark .zone.violet .zico { color: oklch(75% 0.14 300); }
  .zone.amber .zico { background: color-mix(in oklch, oklch(50% 0.12 70) 16%, transparent); color: oklch(50% 0.12 70); }
  html.dark .zone.amber .zico { color: oklch(78% 0.12 75); }
  .zt { font-size: 16px; font-weight: 750; }
  .mlink { display: flex; align-items: center; gap: 8px; padding: 10px 6px; font-size: 13.5px;
    border-bottom: 1px solid color-mix(in oklch, var(--border) 60%, transparent); }
  .mlink:last-child { border-bottom: 0; }
  .mlink:hover { color: var(--primary); }
  .mlink .arr { margin-left: auto; opacity: 0; width: 13px; height: 13px; }
  .mlink:hover .arr { opacity: 1; }

  /* ===== 03 社区脉搏 ===== */
  .pulse { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 10px 14px; }
  .pulse-row { display: flex; align-items: center; gap: 14px; padding: 13px 10px; border-radius: 12px; }
  .pulse-row:hover { background: color-mix(in oklch, var(--primary) 6%, transparent); }
  .pav { width: 42px; height: 42px; border-radius: 50%; flex: none; display: flex; align-items: center;
    justify-content: center; color: #fff; font-weight: 700; font-size: 15px; }
  .pmain { flex: 1; min-width: 0; }
  .ptitle { font-weight: 650; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pmeta { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .pstats { display: flex; gap: 14px; font-size: 12px; color: var(--muted); flex: none; }
  .live { display: inline-flex; align-items: center; gap: 7px; }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 22%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in oklch, var(--primary) 8%, transparent); } }

  /* ===== 04 版块速览 ===== */
  .cats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  @media (max-width: 1100px) { .cats { grid-template-columns: repeat(2, 1fr); } }
  .catgroup { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 16px 18px; }
  .catname { font-size: 13px; font-weight: 700; color: var(--muted); margin-bottom: 10px; }
  .catchips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 5px 13px; border: 1px solid var(--border); border-radius: 999px; font-size: 12.5px; background: var(--bg); }
  .chip:hover { border-color: var(--primary); color: var(--primary); }

  footer { max-width: 1400px; margin: 0 auto; padding: 0 16px 50px; font-size: 12px; color: var(--muted); }
"""

BODY = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Chiphell — 首页</title>
<style>{CSS}</style>
</head>
<body><div class="tin">
  <a class="logo" href="#"><span class="logomark">chip<br>hell</span>Chiphell</a>
  <ul class="nav">{nav_html}</ul>
  <div class="sp"></div>
  <div class="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
    <input placeholder="搜索帖子、版块…">
  </div>
  <button class="cta ghost2" onclick="document.documentElement.classList.toggle('dark')">◐</button>
  <button class="cta">发帖</button>
</div></header>

<div class="page">

  <div class="hero-band">
    <div class="hero">
      <img src="{esc(hero["image"] or "")}" alt="">
      <div class="hero-shade"></div>
      <div class="hero-cap">
        <span class="hero-tag">今日焦点</span>
        <div class="hero-t">{esc(hero["title"])}</div>
      </div>
    </div>
    <div class="flashpanel">
      <div class="fp-head"><span class="fp-dot"></span><span class="fp-t">快讯</span><span class="fp-n">今日 {len(news)} 条</span></div>
      {news_html}
    </div>
  </div>

  <div>
    <div class="sec"><span class="idx">01</span><span class="st">CHH评测室</span><span class="ss">深度 · 专业 · 首发</span><a class="more" href="#">全部评测 →</a></div>
    <div class="review-bento">{feat_html}{rest_html}</div>
  </div>

  <div class="duo">
    <section class="zone violet">
      <div class="zhead"><span class="zico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span><span class="zt">文化</span></div>
      {culture_html}
    </section>
    <section class="zone amber">
      <div class="zhead"><span class="zico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span><span class="zt">专题</span></div>
      {topics_html}
    </section>
  </div>

  <div>
    <div class="sec"><span class="idx">02</span><span class="st">社区脉搏</span><span class="live"><span class="live-dot"></span>实时</span><a class="more" href="#">进入论坛 →</a></div>
    <div class="pulse">{threads_html}</div>
  </div>

  <div>
    <div class="sec"><span class="idx">03</span><span class="st">版块速览</span><a class="more" href="#">全部版块 →</a></div>
    <div class="cats">{cats_html}</div>
  </div>

</div>

<footer>Chiphell · remakeweb Spectrum 重绘 v4 — 编辑部杂志式布局</footer>
"""

OUT.write_text(BODY, encoding="utf-8")
print("生成:", OUT, f"({OUT.stat().st_size//1024}KB)")
