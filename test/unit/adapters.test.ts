import { afterEach, describe, expect, it } from "vitest";
import { runAdapters } from "../../src/content/adapters";
import { DEFAULT_SETTINGS } from "../../src/content/settings";

afterEach(() => {
  document.body.innerHTML = "";
  window.history.pushState({}, "", "/");
  document.documentElement.removeAttribute("data-omchh-liquid-header-ready");
  document.documentElement.removeAttribute("data-chh-lg-scrolled");
  document.documentElement.removeAttribute("data-chh-lg-pressed");
  document.documentElement.style.removeProperty("--chh-lg-pointer-x");
  document.documentElement.style.removeProperty("--chh-lg-pointer-y");
});

describe("content adapters", () => {
  it("marks thread list semantics idempotently without rebuilding Discuz nodes", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="ct">
          <div id="pgt"></div>
          <div id="thread_types"></div>
          <div id="threadlist">
            <table id="threadlisttableid">
              <tbody id="stickthread_1"><tr><th class="common"><a href="/thread-1-1-1.html">置顶主题</a></th><td class="by">作者</td><td class="num">10/100</td></tr></tbody>
              <tbody id="normalthread_2"><tr><th class="new"><a href="/thread-2-1-1.html">普通主题</a></th><td class="by">作者</td><td class="num">1/20</td></tr></tbody>
            </table>
          </div>
          <div id="f_pst"><textarea>draft</textarea></div>
        </div>
      </div>
    `;

    runAdapters("thread-list", DEFAULT_SETTINGS);
    runAdapters("thread-list", DEFAULT_SETTINGS);

    const rows = document.querySelectorAll(".omchh-thread-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-omchh-thread-kind")).toBe("sticky");
    expect(rows[1].getAttribute("data-omchh-thread-kind")).toBe("normal");
    expect(document.querySelector("#threadlist")?.classList.contains("omchh-thread-list")).toBe(true);
    expect((document.querySelector("#f_pst textarea") as HTMLTextAreaElement | null)?.value).toBe("draft");

    const enhancedTokens = rows[0].getAttribute("data-omchh-enhanced")?.split(/\s+/).filter(Boolean) ?? [];
    expect(enhancedTokens.filter((token) => token === "thread-list")).toHaveLength(1);
  });

  it("marks forumdisplay subforum tables without treating them as forum-index cards", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="ct">
          <div class="bm bml pbn">
            <div class="bm_h cl">
              <span class="y"><a id="a_favorite" href="/favorite">收藏本版 <strong>(<span>30</span>)</strong></a><span class="pipe">|</span><a class="fa_rss" href="/rss">订阅</a></span>
              <h1 class="xs2"><a href="/forum-99-1.html">活动区归档</a><span class="xs1 xw0 i">今日: <strong>0</strong><span class="pipe">|</span>主题: <strong>164</strong><span class="pipe">|</span>排名: <strong>13</strong></span></h1>
            </div>
          </div>
          <div class="bm bmw fl">
            <div class="bm_h cl"><span class="o"><em class="tg_no" id="subforum_99_img" onclick="toggle_collapse('subforum_99');" title="收起/展开"></em></span><h2>子版块</h2></div>
            <div class="bm_c" id="subforum_99">
              <table class="fl_tb">
                <tbody>
                  <tr>
                    <td class="fl_icn"><a href="/forum-296-1.html">icon</a></td>
                    <td><h2><a href="/forum-296-1.html">评选你心目中的2016年最佳品牌</a></h2></td>
                    <td class="fl_i"><span>14</span><span> / 143</span></td>
                    <td class="fl_by"><div><a href="/thread-1.html">主板</a> <cite>2016-12-30 ztzbenben</cite></div></td>
                  </tr>
                  <tr>
                    <td class="fl_icn"></td>
                    <td></td>
                    <td class="fl_i"></td>
                    <td class="fl_by"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div id="threadlist">
            <table id="threadlisttableid">
              <tbody><tr><th>公告: Chiphell社区积分等级规则2013版.</th><td class="by">nApoleon</td></tr></tbody>
              <tbody id="separatorline"><tr class="ts"><th>&nbsp;</th></tr></tbody>
              <tbody id="normalthread_2"><tr><td class="icn">icon</td><th class="new"><a href="/thread-2-1-1.html">普通主题</a></th><td class="by">作者</td><td class="num">1/20</td><td class="by">最后回复</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    runAdapters("thread-list", DEFAULT_SETTINGS);

    expect(document.querySelector("#ct")?.classList.contains("omchh-thread-list-route")).toBe(true);
    expect(document.querySelector(".omchh-forum-heading .bm_h")?.classList.contains("omchh-forum-heading-layout")).toBe(true);
    expect(document.querySelector(".omchh-forum-heading .bm_h > .y")?.classList.contains("omchh-forum-heading-actions")).toBe(true);
    expect(document.querySelector(".omchh-forum-heading-title")?.classList.contains("omchh-forum-heading-title-row")).toBe(true);
    expect(document.querySelector(".omchh-forum-heading .bm_h > .xs1")?.classList.contains("omchh-forum-heading-meta-row")).toBe(true);
    expect(document.querySelector(".omchh-forum-heading-title .xs1")).toBeNull();
    expect(document.querySelector(".fl.bmw")?.classList.contains("omchh-subforum-section")).toBe(true);
    expect(document.querySelector(".bm_h .o")?.classList.contains("omchh-subforum-collapse")).toBe(true);
    expect(document.querySelector(".bm_h .o em")?.getAttribute("role")).toBe("button");
    expect(document.querySelector(".bm_h .o em")?.getAttribute("tabindex")).toBe("0");
    expect(document.querySelector(".bm_h .o em")?.getAttribute("aria-controls")).toBe("subforum_99");
    expect(document.querySelector(".bm_h .o em")?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".fl_tb")?.classList.contains("omchh-subforum-table")).toBe(true);
    expect(document.querySelectorAll(".fl_tb tr.omchh-subforum-row")).toHaveLength(1);
    expect(document.querySelector(".fl_tb tr")?.classList.contains("omchh-subforum-row")).toBe(true);
    expect(document.querySelector(".fl_tb tr")?.getAttribute("data-omchh-subforum-index")).toBe("0");
    expect(document.querySelectorAll(".fl_tb tr.omchh-subforum-empty")).toHaveLength(1);
    expect(document.querySelector(".fl_i")?.classList.contains("omchh-subforum-stats")).toBe(true);
    expect(document.querySelector(".fl_by")?.classList.contains("omchh-subforum-lastpost")).toBe(true);
    expect(document.querySelector(".fl_tb td")?.classList.contains("omchh-board-card")).toBe(false);
    expect(document.querySelector("#threadlisttableid > tbody:not([id])")?.classList.contains("omchh-thread-notice-row")).toBe(true);
    expect(document.querySelector("#separatorline")?.classList.contains("omchh-thread-separator")).toBe(true);
    expect(document.querySelector(".omchh-thread-row .icn")?.classList.contains("omchh-thread-icon")).toBe(true);
    expect(document.querySelector(".omchh-thread-row .by:last-child")?.classList.contains("omchh-thread-lastpost")).toBe(true);
  });

  it("marks forum index board cards and common page chrome", () => {
    document.body.innerHTML = `
      <div id="toptb"></div>
      <div id="hd"></div>
      <div id="nv"></div>
      <div id="scbar"></div>
      <div id="wp"><div id="ct"><div class="bm bmw flg"><div class="bm_h"><h2>硬件区</h2></div><div class="bm_c"><div class="fl_g"><dt>主板</dt><dd>今日更新</dd></div></div></div></div></div>
    `;

    runAdapters("forum-index", DEFAULT_SETTINGS);

    expect(document.querySelector("#wp")?.classList.contains("omchh-page")).toBe(true);
    expect(document.querySelector("#nv")?.classList.contains("omchh-nav")).toBe(true);
    expect(document.querySelector("#hd")?.classList.contains("omchh-site-chrome")).toBe(true);
    expect(document.querySelector(".bm")?.classList.contains("omchh-module")).toBe(true);
    expect(document.querySelector(".fl_g")?.classList.contains("omchh-board-card")).toBe(true);
    expect(document.querySelector(".fl_g")?.getAttribute("data-omchh-board-index")).toBe("0");
  });

  it("restructures the Chiphell header without replacing quick menu or search nodes", () => {
    document.body.innerHTML = `
      <div id="toptb"><div class="wp"><div class="z"><a href="/forum.php">社区</a></div><div class="y"><a id="switchblind" href="javascript:;">开启辅助访问</a></div></div></div>
      <div id="hd">
        <div class="hdc">
          <h2><a href="./"><img class="boardlogo" src="/logo.png" alt="Chiphell" /></a></h2>
          <div id="um"><p><strong><a href="/space-uid-1.html">用户</a></strong></p></div>
        </div>
      </div>
      <div id="nv_ph">
        <div id="nv">
          <ul><li class="a"><a href="/forum.php">社区</a></li><li><a href="/portal.php">门户</a></li></ul>
          <a id="qmenu" href="javascript:;" onmouseover="showForummenu();">快捷导航</a>
        </div>
      </div>
      <div id="qmenu_menu" class="p_pop">
        <ul class="nav"><li><a href="/home.php">好友</a></li></ul>
        <div id="fjump_menu"></div>
      </div>
      <div id="scbar">
        <form id="scbar_form" action="/search.php" onsubmit="searchFocus($('scbar_txt'))">
          <table><tbody><tr>
            <td class="scbar_icon_td"></td>
            <td class="scbar_txt_td"><input id="scbar_txt" name="srchtxt" /></td>
            <td class="scbar_type_td"><a id="scbar_type" href="javascript:;">帖子</a></td>
            <td class="scbar_btn_td"><button id="scbar_btn" type="submit"><strong>搜索</strong></button></td>
          </tr></tbody></table>
        </form>
        <div><form action="https://www.google.com/search"><input type="text" /><button type="submit">Google</button></form></div>
      </div>
      <div id="wp"><div id="ct"><div class="bm bmw flg"><div class="fl_g"><dt>主板</dt></div></div></div></div>
    `;

    const qmenu = document.querySelector("#qmenu") as HTMLAnchorElement;
    const qmenuMenu = document.querySelector("#qmenu_menu") as HTMLElement;
    const fjumpMenu = document.querySelector("#fjump_menu") as HTMLElement;
    const searchForm = document.querySelector("#scbar_form") as HTMLFormElement;

    runAdapters("forum-index", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });
    runAdapters("forum-index", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });

    expect(document.querySelectorAll("#chh-lg-header")).toHaveLength(1);
    expect(document.querySelector("#chh-lg-header #nv")).toBeTruthy();
    expect(document.querySelector("#chh-lg-header #scbar_form")).toBe(searchForm);
    expect(document.querySelector("#qmenu")).toBe(qmenu);
    expect(document.querySelector("#qmenu_menu")).toBe(qmenuMenu);
    expect(document.querySelector("#fjump_menu")).toBe(fjumpMenu);
    expect(qmenuMenu.parentElement).toBe(document.body);
    expect(qmenu.getAttribute("onmouseover")).toContain("showForummenu");
    expect(searchForm.getAttribute("action")).toBe("/search.php");
  });

  it("restructures portal/list headers that have #nv without an #nv_ph wrapper", () => {
    document.body.innerHTML = `
      <div id="toptb"><div class="wp"><div class="z"><a href="/">设为首页</a></div><div class="y"><a id="switchblind" href="javascript:;">开启辅助访问</a></div></div></div>
      <div id="hd">
        <div class="wp">
          <div class="hdc cl">
            <h2><a href="/"><img class="boardlogo" src="/logo.png" alt="Chiphell" /></a></h2>
            <div id="um"><p><strong><a href="/space-uid-1.html">zzNaLogic</a></strong></p></div>
          </div>
        </div>
      </div>
      <div id="nv">
        <a href="javascript:;" id="qmenu" onmouseover="delayShow(this, function () {showForummenu(0);})">快捷导航</a>
        <ul><li class="a"><a href="/">首页</a></li><li><a href="/portal.php?mod=list&catid=1">评测</a></li></ul>
      </div>
      <div id="qmenu_menu" class="p_pop">
        <ul class="nav"><li><a href="/home.php">好友</a></li></ul>
        <div id="fjump_menu"></div>
      </div>
      <div id="mu" class="cl"></div>
      <div id="scbar">
        <form id="scbar_form" action="/search.php?searchsubmit=yes" onsubmit="searchFocus($('scbar_txt'))">
          <input id="scbar_txt" name="srchtxt" />
          <a id="scbar_type" href="javascript:;">帖子</a>
          <button id="scbar_btn" type="submit"><strong>搜索</strong></button>
        </form>
      </div>
      <div id="wp"><div id="ct"><div class="block">门户内容</div></div></div>
    `;

    const nav = document.querySelector("#nv") as HTMLElement;
    const qmenu = document.querySelector("#qmenu") as HTMLAnchorElement;
    const searchForm = document.querySelector("#scbar_form") as HTMLFormElement;

    runAdapters("portal-home", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });
    runAdapters("portal-home", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });

    expect(document.querySelectorAll("#chh-lg-header")).toHaveLength(1);
    expect(document.querySelector("#chh-lg-header #nv")).toBe(nav);
    expect(document.querySelector("#chh-lg-header #scbar_form")).toBe(searchForm);
    expect(document.querySelector("#qmenu")).toBe(qmenu);
    expect(qmenu.getAttribute("onmouseover")).toContain("showForummenu(0)");
    expect(document.querySelectorAll("#chh-lg-header #nv_ph")).toHaveLength(1);
  });

  it("removes the BBS badge from the community nav label while preserving the link", () => {
    document.body.innerHTML = `
      <div id="toptb"><div class="wp"><div class="z"><a href="/">设为首页</a></div></div></div>
      <div id="hd"><div class="hdc"><h2><a href="/"><img class="boardlogo" src="/logo.png" alt="Chiphell" /></a></h2><div id="um"></div></div></div>
      <div id="nv_ph">
        <div id="nv">
          <a href="javascript:;" id="qmenu" onmouseover="showForummenu();">快捷导航</a>
          <ul>
            <li id="mn_N6666"><a href="https://www.chiphell.com/">首页</a></li>
            <li id="mn_forum_2"><a href="https://www.chiphell.com/forum.php" title="BBS">社区<span>BBS</span></a></li>
          </ul>
        </div>
      </div>
      <div id="scbar"><form id="scbar_form" action="/search.php"></form></div>
      <div id="wp"><div id="ct"></div></div>
    `;

    const communityLink = document.querySelector<HTMLAnchorElement>("#mn_forum_2 > a");

    runAdapters("forum-index", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });

    expect(communityLink).toBeTruthy();
    expect(communityLink?.textContent?.replace(/\s+/g, " ").trim()).toBe("社区");
    expect(communityLink?.querySelector("span")).toBeNull();
    expect(communityLink?.getAttribute("title")).toBeNull();
    expect(communityLink?.getAttribute("href")).toContain("/forum.php");
  });

  it("adds the active nav state by current URL when the page does not mark a nav item", () => {
    window.history.pushState({}, "", "/portal.php?mod=list&catid=2");
    document.body.innerHTML = `
      <div id="toptb"><div class="wp"><div class="z"><a href="/">设为首页</a></div></div></div>
      <div id="hd"><div class="hdc"><h2><a href="/"><img class="boardlogo" src="/logo.png" alt="Chiphell" /></a></h2><div id="um"></div></div></div>
      <div id="nv">
        <a href="javascript:;" id="qmenu" onmouseover="showForummenu(0);">快捷导航</a>
        <ul>
          <li id="mn_N6666"><a href="https://www.chiphell.com/">首页</a></li>
          <li id="mn_P1"><a href="https://www.chiphell.com/portal.php?mod=list&amp;catid=1">评测</a></li>
          <li id="mn_P2"><a href="https://www.chiphell.com/portal.php?mod=list&amp;catid=2">电脑</a></li>
          <li id="mn_forum_2"><a href="https://www.chiphell.com/forum.php" title="BBS">社区<span>BBS</span></a></li>
        </ul>
      </div>
      <div id="scbar"><form id="scbar_form" action="/search.php"></form></div>
      <div id="wp"><div id="ct"></div></div>
    `;

    runAdapters("portal-home", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });

    expect(document.querySelector("#mn_P2")?.classList.contains("a")).toBe(true);
    expect(document.querySelector("#mn_P2")?.getAttribute("data-chh-lg-active")).toBe("true");
    expect(document.querySelector("#mn_P2 > a")?.getAttribute("aria-current")).toBe("page");
    expect(document.querySelector("#mn_N6666")?.classList.contains("a")).toBe(false);
    expect(document.querySelector("#mn_forum_2")?.classList.contains("a")).toBe(false);
  });

  it("maps Chiphell portal sections to themeable module/card classes", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="diy_banner"><div class="block"><h2>热门</h2></div></div>
        <div id="diy_xw"><div class="chiphell_box">快讯</div></div>
      </div>
    `;

    runAdapters("portal-home", DEFAULT_SETTINGS);

    expect(document.querySelector("#diy_banner")?.classList.contains("omchh-module")).toBe(true);
    expect(document.querySelector("#diy_xw")?.classList.contains("omchh-module")).toBe(true);
    expect(document.querySelector(".block")?.classList.contains("omchh-portal-card")).toBe(true);
    expect(document.querySelector(".chiphell_box")?.classList.contains("omchh-portal-card")).toBe(true);
    expect(document.querySelector(".block")?.classList.contains("omchh-board-card")).toBe(false);
    expect(document.querySelector(".chiphell_box")?.classList.contains("omchh-board-card")).toBe(false);
  });

  it("adds stable image title data for portal-home banner slides", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="diy_banner">
          <div id="portal_block_672">
            <div class="swiper-slide">
              <img class="img-cover" src="/banner.jpg" />
              <a href="/article-1.html" title="完整标题"><p>截断标题</p></a>
            </div>
          </div>
        </div>
      </div>
    `;

    runAdapters("portal-home", DEFAULT_SETTINGS);

    expect(document.querySelector("#portal_block_672 .swiper-slide")?.getAttribute("data-chh-lg-title")).toBe("完整标题");
  });

  it("adds stable semantic hooks for portal-home latest article cards", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div class="chip_index_pingce cl">
          <div class="atit cl">
            <span>最新文章</span>
            <div class="fra"><a class="a" href="javascript:;" caid="0">全部</a><a href="javascript:;" caid="2">电脑</a></div>
          </div>
          <div class="acon cl">
            <ul id="threadulid">
              <section id="normalthread_1">
                <li>
                  <a class="tm01 cl" href="/article-1.html"><img src="/cover.jpg" /></a>
                  <div class="tmpad cl">
                    <a class="tm03 cl" href="/article-1.html">标题</a>
                    <div class="avart">
                      <a class="tmava" href="/space.html"><img src="/avatar.jpg" /></a>
                      <div class="avimain cl"><a href="/space.html">作者</a></div>
                      <div class="avimain2 cl">2026/06/03 <span class="aview">123</span><span class="arep">4</span><a class="asort cl" href="/portal.php?mod=list&catid=2">电脑</a></div>
                    </div>
                    <div class="tm04 cl">摘要</div>
                  </div>
                </li>
              </section>
            </ul>
          </div>
        </div>
      </div>
    `;

    runAdapters("portal-home", DEFAULT_SETTINGS);
    runAdapters("portal-home", DEFAULT_SETTINGS);

    expect(document.querySelector(".chip_index_pingce")?.classList.contains("omchh-portal-latest")).toBe(true);
    expect(document.querySelector(".fra")?.classList.contains("omchh-portal-latest-filters")).toBe(true);
    expect(document.querySelector("#threadulid")?.classList.contains("omchh-portal-latest-list")).toBe(true);
    expect(document.querySelector("li")?.classList.contains("omchh-portal-latest-card")).toBe(true);
    expect(document.querySelector(".tm01")?.classList.contains("omchh-portal-latest-thumb")).toBe(true);
    expect(document.querySelector(".tm03")?.classList.contains("omchh-portal-latest-title")).toBe(true);
    expect(document.querySelector(".avart")?.classList.contains("omchh-portal-latest-meta")).toBe(true);
    expect(document.querySelector(".avimain")?.classList.contains("omchh-portal-latest-author")).toBe(true);
    expect(document.querySelector(".avimain2")?.classList.contains("omchh-portal-latest-stats")).toBe(true);
    expect(document.querySelector(".tm04")?.classList.contains("omchh-portal-latest-summary")).toBe(true);
    expect(document.querySelector(".asort")?.classList.contains("omchh-portal-latest-category")).toBe(true);
    expect(document.querySelector("li")?.getAttribute("data-omchh-portal-article-index")).toBe("0");
    expect(document.querySelector("li")?.getAttribute("data-omchh-portal-article-category")).toBe("电脑");

    const enhancedTokens = document.querySelector("li")?.getAttribute("data-omchh-enhanced")?.split(/\s+/).filter(Boolean) ?? [];
    expect(enhancedTokens.filter((token) => token === "portal-home")).toHaveLength(1);
  });

  it("adds stable semantic hooks for portal category list content without replacing articles", () => {
    document.body.className = "pg_list pg_list_2";
    document.body.id = "nv_portal";
    document.body.innerHTML = `
      <div id="wp">
        <div id="ct" class="ct2 wp cl">
          <div class="mn">
            <div class="bm">
              <div class="bm_h cl"><a class="y xi2 rss" href="/portal.php?mod=rss&catid=2">订阅</a><h1 class="xs2">电脑</h1></div>
              <div class="bm_c bbda">
                下级分类:
                <a class="xi2" href="/portal.php?mod=list&catid=99">整机搭建</a>
                <span class="pipe">|</span>
                <a class="xi2" href="/portal.php?mod=list&catid=101">桌面书房</a>
              </div>
              <div class="bm_c xld">
                <dl class="bbda cl">
                  <dt class="xs2"><a class="xi2" href="/article-34989-1.html" target="_blank">银色战机装机分享</a></dt>
                  <dd class="xs2 cl"><div class="atc"><a href="/article-34989-1.html"><img class="tn" src="/cover.jpg" /></a></div>前言摘要</dd>
                  <dd><label><a href="/portal.php?mod=list&catid=99">整机搭建</a></label><span class="xg1">2026-5-25 08:06</span></dd>
                </dl>
              </div>
            </div>
            <div class="pgs cl"><div class="pg"><strong>1</strong><a href="/portal.php?mod=list&catid=2&page=2">2</a></div></div>
          </div>
          <div class="sd pph">
            <div class="bm"><div class="bm_h cl"><h2>相关分类</h2></div><div class="bm_c"><ul class="xl xl2 cl"><li>• <a href="/portal.php?mod=list&catid=1">评测</a></li><li>• <a href="/portal.php?mod=list&catid=2">电脑</a></li></ul></div></div>
          </div>
        </div>
      </div>
    `;

    const article = document.querySelector("dl.bbda") as HTMLElement;
    const titleLink = document.querySelector("dt a") as HTMLAnchorElement;

    runAdapters("portal-home", DEFAULT_SETTINGS);
    runAdapters("portal-home", DEFAULT_SETTINGS);

    expect(document.querySelector("#ct")?.classList.contains("omchh-portal-list-route")).toBe(true);
    expect(document.querySelector("#ct .mn")?.classList.contains("omchh-portal-list-main")).toBe(true);
    expect(document.querySelector("#ct .sd")?.classList.contains("omchh-portal-list-sidebar")).toBe(true);
    expect(document.querySelector("#ct .mn > .bm")?.classList.contains("omchh-portal-list-shell")).toBe(true);
    expect(document.querySelector("#ct .mn > .bm > .bm_h")?.classList.contains("omchh-portal-list-header")).toBe(true);
    expect(document.querySelector("#ct .mn > .bm > .bm_c.bbda")?.classList.contains("omchh-portal-list-subcats")).toBe(true);
    expect(document.querySelector("#ct .mn > .bm > .bm_c.xld")?.classList.contains("omchh-portal-list-stream")).toBe(true);
    expect(article.classList.contains("omchh-portal-list-card")).toBe(true);
    expect(document.querySelector("dt")?.classList.contains("omchh-portal-list-title")).toBe(true);
    expect(document.querySelector(".atc")?.classList.contains("omchh-portal-list-thumb")).toBe(true);
    expect(document.querySelector("dd.xs2")?.classList.contains("omchh-portal-list-summary")).toBe(true);
    expect(document.querySelector("dd:not(.xs2)")?.classList.contains("omchh-portal-list-meta")).toBe(true);
    expect(document.querySelector("label")?.classList.contains("omchh-portal-list-category")).toBe(true);
    expect(document.querySelector("span.xg1")?.classList.contains("omchh-portal-list-date")).toBe(true);
    expect(document.querySelector("#ct .sd .bm")?.classList.contains("omchh-portal-list-side-card")).toBe(true);
    expect(article.getAttribute("data-omchh-portal-list-index")).toBe("0");
    expect(article.getAttribute("data-omchh-portal-list-category")).toBe("整机搭建");
    expect(article).toBe(document.querySelector("dl.bbda"));
    expect(document.querySelector("dt a")).toBe(titleLink);

    const enhancedTokens = article.getAttribute("data-omchh-enhanced")?.split(/\s+/).filter(Boolean) ?? [];
    expect(enhancedTokens.filter((token) => token === "portal-home")).toHaveLength(1);
  });
});


describe("liquid glass sample parity hooks", () => {
  it("restores sample forum-home DOM hooks for cards, slider, footer, and quick rail", () => {
    document.body.innerHTML = `
      <div id="toptb"><div class="wp"><div class="z"><a href="/">设为首页</a></div></div></div>
      <div id="hd"><div class="hdc"><h2><a href="/"><img class="boardlogo" src="/logo.png" alt="Chiphell" /></a></h2><div id="um"></div></div></div>
      <div id="nv_ph"><div id="nv"><ul><li class="a"><a href="/forum.php">社区</a></li></ul><a id="qmenu" href="javascript:;">快捷导航</a></div></div>
      <div id="scbar"><form id="scbar_form" action="/search.php"></form></div>
      <div id="wp">
        <div id="ct">
          <div id="portal_block_34" style="border: 1px solid red; margin-right: 10px;">
            <div class="slidebox"><div class="slidebar"><ul><li class="on">1</li><li>2</li></ul></div></div>
            <div class="blocktitle"><span class="titletext" style="color: red"><a style="color: red">评测</a></span></div>
          </div>
          <div class="fl bm">
            <div class="bm bmw flg">
              <div class="bm_h"><span class="o"><em>收起</em></span><h2><a style="color: red">互动区</a></h2></div>
              <div class="bm_c"><table class="fl_tb"><tbody><tr>
                <td class="fl_g"><div class="fl_icn_g"><a></a></div><dl><dt><a style="color: red">原创分享</a></dt><dd>主题: 1万</dd><dd>最后发表</dd></dl></td>
              </tr></tbody></table></div>
            </div>
          </div>
        </div>
      </div>
      <div id="ft"><div id="flk"><p>( <a style="width: 110px; height: 40px; zoom: 1"><img border="0" /></a> )</p></div><div id="frt"></div></div>
      <div id="scrolltop" style="left: 100px"><span><a class="scrolltopa"><b>返回顶部</b></a></span></div>
    `;

    runAdapters("forum-index", { ...DEFAULT_SETTINGS, themeId: "liquid-glass" });

    expect(document.documentElement.classList.contains("chh-liquid-glass")).toBe(true);
    expect(document.body.classList.contains("chh-liquid-glass")).toBe(true);
    expect(document.querySelector("#portal_block_34")?.getAttribute("style") ?? "").not.toContain("border");
    expect(document.querySelector("#portal_block_34 .slidebar")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll("#portal_block_34 .chh-lg-slide-nav")).toHaveLength(2);
    expect(document.querySelector(".bmw.flg")?.getAttribute("data-chh-lg-forum-section")).toBe("1");
    expect(document.querySelector(".bm_h .o")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector("td.fl_g")?.getAttribute("data-chh-lg-forum-card")).toBe("true");
    expect(document.querySelector(".bm_h h2 a")?.getAttribute("style")).toBeNull();
    expect(document.querySelector("td.fl_g dt a")?.getAttribute("style")).toBeNull();
    expect(document.querySelector("#ft")?.getAttribute("data-chh-lg-footer")).toBe("true");
    expect(document.querySelector("#flk a")?.getAttribute("data-chh-lg-footer-badge")).toBe("true");
    expect(document.querySelector("#flk img")?.getAttribute("border")).toBeNull();
    expect(document.querySelector("#scrolltop")?.getAttribute("data-chh-lg-action-rail")).toBe("true");
    expect(document.querySelector("#scrolltop")?.getAttribute("style")).toBeNull();
    expect(document.querySelector("#scrolltop a")?.getAttribute("aria-label")).toBe("返回顶部");
  });
});
