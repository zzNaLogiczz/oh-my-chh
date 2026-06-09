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
          <div id="pgt">
            <span id="fd_page_top"><div class="pg"><strong>1</strong><a href="/forum-99-2.html">2</a></div></span>
            <span class="pgb y" id="visitedforums"><a href="/forum.php">返 回</a></span>
            <a class="pgsbtn showmenu" id="newspecial" href="javascript:;" title="发新帖">发新帖</a>
          </div>
          <div id="thread_types"></div>
          <div id="threadlist">
            <table id="threadlisttableid">
              <tbody id="stickthread_1"><tr><th class="common"><a href="/thread-1-1-1.html">置顶主题</a></th><td class="by">作者</td><td class="num">10/100</td></tr></tbody>
              <tbody id="normalthread_2"><tr><th class="new"><a href="/thread-2-1-1.html">普通主题</a></th><td class="by">作者</td><td class="num">1/20</td></tr></tbody>
            </table>
          </div>
          <div id="f_pst"><textarea>draft</textarea></div>
          <div class="bm bw0 pgs cl">
            <span id="fd_page_bottom"><div class="pg"><strong>1</strong><a href="/forum-99-2.html">2</a><label><input class="px" name="custompage" /><span> / 2 页</span></label><a class="nxt" href="/forum-99-2.html">下一页</a></div></span>
            <span class="pgb y" id="visitedforumstmp"><a href="/forum.php">返 回</a></span>
            <a class="pgsbtn showmenu" id="newspecialtmp" href="javascript:;" title="发新帖">发新帖</a>
          </div>
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
    expect(document.querySelector("#fd_page_top")?.classList.contains("omchh-thread-top-pagination")).toBe(true);
    expect(document.querySelector("#fd_page_bottom")?.classList.contains("omchh-thread-bottom-pagination")).toBe(true);
    expect(document.querySelector("#fd_page_bottom")?.parentElement?.classList.contains("omchh-thread-bottom-toolbar")).toBe(true);
    expect(document.querySelector("#visitedforums")?.classList.contains("omchh-thread-back-action")).toBe(true);
    expect(document.querySelector("#visitedforumstmp")?.classList.contains("omchh-thread-back-action")).toBe(true);
    expect(document.querySelector("#newspecial")?.classList.contains("omchh-thread-new-action")).toBe(true);
    expect(document.querySelector("#newspecialtmp")?.classList.contains("omchh-thread-new-action")).toBe(true);
    expect((document.querySelector("#f_pst textarea") as HTMLTextAreaElement | null)?.value).toBe("draft");

    const enhancedTokens = rows[0].getAttribute("data-omchh-enhanced")?.split(/\s+/).filter(Boolean) ?? [];
    expect(enhancedTokens.filter((token) => token === "thread-list")).toHaveLength(1);
  });

  it("always marks forumdisplay quick post so reloads cannot leave it unstyled", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="ct">
          <div id="threadlist">
            <table id="threadlisttableid">
              <tbody id="normalthread_1"><tr><th class="new"><a href="/thread-1-1-1.html">普通主题</a></th><td class="by">作者</td><td class="num">1/20</td></tr></tbody>
            </table>
          </div>
          <div id="f_pst"><div class="bm_h"><h2>快速发帖</h2></div><textarea>draft</textarea></div>
        </div>
      </div>
    `;

    runAdapters("thread-list", { ...DEFAULT_SETTINGS, enhanceQuickReply: false });

    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(true);
    expect((document.querySelector("#f_pst textarea") as HTMLTextAreaElement | null)?.value).toBe("draft");
  });

  it("always marks thread-detail quick reply so stored settings cannot leave the composer unstyled", () => {
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist"></div>
        <div id="f_pst" class="pl bm bmw">
          <form id="fastpostform">
            <table><tbody><tr>
              <td class="pls"><div class="avatar avtm"><img src="/me.jpg" /></div></td>
              <td class="plc">
                <span id="fastpostreturn"></span>
                <div id="fastposteditor" class="hasfsl"><div class="tedt mtn"><div class="bar"><span class="y"><a href="/advanced">高级模式</a></span><div class="fpd"><a class="fbld">B</a></div></div><div class="area"><textarea id="fastpostmessage" name="message">draft</textarea></div></div></div>
                <div id="seccheck_fastpost"></div>
                <p class="ptm pnpost"><a class="y" href="/rule">本版积分规则</a><button id="fastpostsubmit"><strong>发表回复</strong></button><label for="fastpostrefresh"><input id="fastpostrefresh" type="checkbox" />回帖后跳转到最后一页</label></p>
              </td>
            </tr></tbody></table>
          </form>
        </div>
      </div>
    `;

    runAdapters("thread-detail", { ...DEFAULT_SETTINGS, enhanceQuickReply: false });

    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(true);
    expect(document.querySelector("#fastpostform")?.classList.contains("omchh-thread-reply-form")).toBe(true);
    expect(document.querySelector(".pls")?.classList.contains("omchh-thread-reply-avatar")).toBe(true);
    expect(document.querySelector("#fastpostmessage")?.classList.contains("omchh-thread-reply-textarea")).toBe(true);
    expect((document.querySelector("#fastpostmessage") as HTMLTextAreaElement | null)?.value).toBe("draft");
  });

  it("adds rich thread-detail post and reply hooks without rebuilding Discuz controls", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="ct">
          <div id="pgt" class="pgs mbm cl">
            <span class="y pgb" id="visitedforums"><a href="/forum-290-1.html">返回列表</a></span>
            <a id="newspecial" class="pgsbtn showmenu" href="javascript:;" onclick="showWindow('newthread', '/new')">发新帖</a>
            <a id="post_reply" class="pgsbtn" href="javascript:;" onclick="showWindow('reply', '/reply')">回复</a>
          </div>
          <div id="postlist" class="pl bm">
            <table cellspacing="0" cellpadding="0">
              <tbody>
                <tr>
                  <td class="pls ptn pbn">
                    <div class="hm ptn"><span class="xg1">查看:</span> <span class="xi1">1157</span><span class="pipe">|</span><span class="xg1">回复:</span> <span class="xi1">72</span></div>
                  </td>
                  <td class="plc ptm pbn vwthd">
                    <div class="y"><a href="/print" title="打印">打印</a></div>
                    <h1 class="ts"><a href="/type">[水族]</a><span id="thread_subject">纯新手想入坑小鱼缸</span></h1>
                    <span class="xg1"><a href="/thread" onclick="return copyThreadUrl(this, 'Chiphell')">[复制链接]</a></span>
                  </td>
                </tr>
              </tbody>
            </table>
            <table class="ad"><tbody><tr><td class="pls"></td><td class="plc"></td></tr></tbody></table>
            <div id="post_1">
              <table id="pid1" class="plhin" summary="pid1" cellspacing="0" cellpadding="0">
                <tbody>
                  <tr>
                    <td class="pls" rowspan="2">
                      <div id="favatar1" class="pls cl favatar">
                        <div class="pi"><div class="authi"><a class="xw1" href="/space-1">楼主</a></div></div>
                        <div><div class="avatar"><a class="avtm" href="/space-1"><img class="user_avatar" src="/avatar.jpg" /></a></div></div>
                        <div class="tns xg2"><table><tbody><tr><th><p><a>12</a></p>主题</th><td><p><a>345</a></p>积分</td></tr></tbody></table></div>
                        <p><em>大恶魔</em></p>
                        <p class="xg1">一条咸鱼</p>
                        <dl class="pil cl"><dt>精华</dt><dd>0</dd></dl>
                        <p class="md_ctrl"><a href="/medal"><img alt="见证十周年" src="/medal.png" /></a></p>
                        <ul class="xl xl2 o cl"><li class="pm2"><a href="/pm" onclick="showWindow('sendpm', this.href);">发消息</a></li></ul>
                      </div>
                    </td>
                    <td class="plc">
                      <div class="pi">
                        <div class="y" id="fj"><label class="z">电梯直达</label><input class="px p_fre z" /><a class="z fico-down" id="fj_btn" href="javascript:;"></a></div>
                        <strong><a href="/thread#1" id="postnum1" onclick="setCopy(this.href, 'ok');return false;"><em>1</em><sup>#</sup></a></strong>
                        <div class="pti"><div class="authi"><em id="authorposton1">发表于 2026-6-4 15:59</em><span class="pipe">|</span><a href="/author">只看该作者</a><span class="pipe">|</span><a href="/album">只看大图</a></div></div>
                      </div>
                      <div class="pct"><div class="pcb"><div class="t_fsz"><table><tbody><tr><td class="t_f" id="postmessage_1">目前的想法是桌面小鱼缸，能养好养的小鱼就行。</td></tr></tbody></table></div><div id="comment_1" class="cm"></div><div id="post_rate_div_1"></div></div></div>
                    </td>
                  </tr>
                  <tr><td class="plc plm"><div id="p_btn" class="mtw mbm hm cl"><a id="k_favorite" href="/favorite">收藏<span id="favoritenumber">5</span></a></div></td></tr>
                  <tr id="_postposition1"></tr>
                  <tr><td class="pls"></td><td class="plc" style="overflow:visible;"><div class="po hin"><div class="pob cl"><em><a class="fastre" href="/reply" onclick="showWindow('reply', this.href)">回复</a></em><p><a href="/report" onclick="return false;">举报</a></p></div></div></td></tr>
                </tbody>
              </table>
            </div>
            <div id="post_2">
              <table id="pid2" class="plhin" summary="pid2" cellspacing="0" cellpadding="0">
                <tbody>
                  <tr>
                    <td class="pls" rowspan="2"><div id="favatar2" class="pls cl favatar"><div class="pi"><div class="authi"><a class="xw1" href="/space-2">回复者</a></div></div><div><div class="avatar"><a class="avtm"><img src="/avatar2.jpg" /></a></div></div></div></td>
                    <td class="plc"><div class="pi"><strong><a href="/thread#2" id="postnum2"><em>2</em><sup>#</sup></a></strong><div class="pti"><div class="authi"><em id="authorposton2">发表于 2026-6-4 16:12</em><span class="pipe">|</span><a href="/author2">只看该作者</a></div></div></div><div class="pct"><div class="pcb"><div class="t_fsz"><table><tbody><tr><td class="t_f" id="postmessage_2">小缸最好先补水质和过滤。</td></tr></tbody></table></div></div></div></td>
                  </tr>
                  <tr><td class="plc plm"></td></tr>
                  <tr><td class="pls"></td><td class="plc"><div class="po hin"><div class="pob cl"><em><a class="fastre" href="/reply2">回复</a></em></div></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div id="f_pst" class="pl bm bmw">
            <form id="fastpostform" method="post" onsubmit="return fastpostvalidate(this)">
              <table><tbody><tr><td class="pls"><div class="avatar avtm"><img src="/me.jpg" /></div></td><td class="plc"><span id="fastpostreturn"></span><div class="cl"><div id="fastposteditor" class="hasfsl"><div class="tedt mtn"><div class="bar"><span class="y"><a href="/advanced">高级模式</a></span><div class="fpd"><a class="fbld" href="javascript:;">B</a><a class="fmg" id="fastpostimg" href="javascript:;">Image</a></div></div><div class="area"><textarea class="pt" id="fastpostmessage" name="message">draft</textarea></div></div></div></div><p class="ptm pnpost"><a class="y" href="/rule">本版积分规则</a><button class="pn pnc vm" id="fastpostsubmit" name="replysubmit" type="submit"><strong>发表回复</strong></button></p></td></tr></tbody></table>
            </form>
          </div>
        </div>
      </div>
    `;

    runAdapters("thread-detail", DEFAULT_SETTINGS);
    runAdapters("thread-detail", DEFAULT_SETTINGS);

    expect(document.querySelector("#ct")?.classList.contains("omchh-thread-detail")).toBe(true);
    expect(document.querySelector("#pgt")?.classList.contains("omchh-thread-toolbar")).toBe(true);
    expect(document.querySelector("#postlist > table")?.classList.contains("omchh-thread-title-card")).toBe(true);
    expect(document.querySelector(".hm")?.classList.contains("omchh-thread-stat-stack")).toBe(true);
    expect(document.querySelector(".vwthd")?.classList.contains("omchh-thread-title-area")).toBe(true);
    expect(document.querySelector("#thread_subject")?.classList.contains("omchh-thread-subject")).toBe(true);

    const postShells = Array.from(document.querySelectorAll<HTMLElement>(".omchh-post-shell"));
    const posts = Array.from(document.querySelectorAll<HTMLElement>(".omchh-post"));
    expect(postShells).toHaveLength(2);
    expect(posts).toHaveLength(2);
    expect(posts.map((post) => post.dataset.omchhPostRole)).toEqual(["original", "reply"]);
    expect(document.querySelectorAll(".omchh-post-author")).toHaveLength(2);
    expect(document.querySelectorAll(".omchh-post-content")).toHaveLength(2);
    expect(document.querySelectorAll(".omchh-post-floor-shell")).toHaveLength(2);
    expect(document.querySelectorAll(".omchh-post-floor")).toHaveLength(2);
    expect(document.querySelectorAll(".omchh-post-body")).toHaveLength(2);
    expect(document.querySelectorAll(".omchh-post-action-bar")).toHaveLength(2);
    expect(document.querySelector("#favatar1 .avatar")?.parentElement?.classList.contains("omchh-post-avatar-shell")).toBe(true);
    expect(document.querySelector("#favatar1 > p:not(.xg1):not(.md_ctrl)")?.classList.contains("omchh-post-author-rank")).toBe(true);
    expect(document.querySelector("#favatar1 > p.xg1")?.classList.contains("omchh-post-author-tagline")).toBe(true);
    expect(document.querySelector("#favatar1 > ul.o")?.classList.contains("omchh-post-author-contact")).toBe(true);
    const greaterDemonRank = document.querySelector<HTMLElement>("#favatar1 > p:not(.xg1):not(.md_ctrl)");
    const greaterDemonCard = document.querySelector<HTMLElement>("#favatar1");
    const greaterDemonAvatarShell = document.querySelector<HTMLElement>("#favatar1 .omchh-post-avatar-shell");
    expect(greaterDemonRank?.dataset.omchhRank).toBe("greater-demon");
    expect(greaterDemonRank?.dataset.omchhRankFamily).toBe("demon");
    expect(greaterDemonRank?.dataset.omchhRankTier).toBe("13");
    expect(greaterDemonRank?.dataset.omchhRankEffect).toBe("2");
    expect(greaterDemonRank?.dataset.omchhRankBadge).toBe("heraldic");
    const greaterDemonBadge = greaterDemonRank?.querySelector<HTMLElement>(".omchh-rank-badge");
    expect(greaterDemonBadge?.classList.contains("t-greater")).toBe(true);
    expect(greaterDemonBadge?.classList.contains("fx-orbit")).toBe(true);
    expect(greaterDemonBadge?.querySelector(".crest svg")).not.toBeNull();
    expect(greaterDemonBadge?.querySelectorAll(".spk")).toHaveLength(4);
    expect(greaterDemonBadge?.querySelector(".bname")?.textContent).toBe("大恶魔");
    expect(greaterDemonCard?.dataset.omchhRank).toBe("greater-demon");
    expect(greaterDemonAvatarShell?.dataset.omchhRank).toBe("greater-demon");

    expect(document.querySelector("#f_pst")?.classList.contains("omchh-quick-reply")).toBe(true);
    expect(document.querySelector("#fastpostform")?.classList.contains("omchh-thread-reply-form")).toBe(true);
    expect(document.querySelector("#fastpostmessage")?.classList.contains("omchh-thread-reply-textarea")).toBe(true);
    expect((document.querySelector("#fastpostmessage") as HTMLTextAreaElement | null)?.value).toBe("draft");
  });

  it("maps management rank labels to high-intensity identity data without replacing nodes", () => {
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist">
          <div id="post_1">
            <table id="pid1" class="plhin" cellspacing="0" cellpadding="0">
              <tbody>
                <tr>
                  <td class="pls" rowspan="2">
                    <div id="favatarAdmin" class="pls cl favatar">
                      <div class="pi"><div class="authi"><a class="xw1" href="/space-admin">lionnor</a></div></div>
                      <div><div class="avatar"><a class="avtm" href="/space-admin"><img src="/admin.jpg" /></a></div></div>
                      <p><em>圣魔使-迪亚波罗</em></p>
                      <p class="xg1">顺其自然</p>
                    </div>
                  </td>
                  <td class="plc">
                    <div class="pi"><strong><a href="/thread#1" id="postnum1"><em>1</em><sup>#</sup></a></strong><div class="pti"><div class="authi"><em>发表于 2026-6-4 15:59</em></div></div></div>
                    <div class="pct"><div class="pcb"><div class="t_fsz"><table><tbody><tr><td class="t_f" id="postmessage_1">管理组用户。</td></tr></tbody></table></div></div></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    runAdapters("thread-detail", DEFAULT_SETTINGS);

    const originalRankNode = document.querySelector<HTMLElement>("#favatarAdmin > p:not(.xg1):not(.md_ctrl)");
    const authorCard = document.querySelector<HTMLElement>("#favatarAdmin");
    const authorCell = document.querySelector<HTMLElement>(".omchh-post-author");
    const avatarShell = document.querySelector<HTMLElement>("#favatarAdmin .omchh-post-avatar-shell");

    expect(originalRankNode?.textContent?.trim()).toBe("圣魔使-迪亚波罗");
    expect(originalRankNode?.dataset.omchhRank).toBe("diablo");
    expect(originalRankNode?.dataset.omchhRankFamily).toBe("admin");
    expect(originalRankNode?.dataset.omchhRankTier).toBe("90");
    expect(originalRankNode?.dataset.omchhRankEffect).toBe("3");
    expect(originalRankNode?.dataset.omchhRankBadge).toBe("heraldic");
    const adminBadge = originalRankNode?.querySelector<HTMLElement>(".omchh-rank-badge");
    expect(adminBadge?.classList.contains("t-envoy")).toBe(true);
    expect(adminBadge?.querySelector(".aurora")).not.toBeNull();
    expect(adminBadge?.querySelector(".bname")?.textContent).toBe("圣魔使-迪亚波罗");
    expect(authorCard?.dataset.omchhRankFamily).toBe("admin");
    expect(authorCell?.dataset.omchhRank).toBe("diablo");
    expect(avatarShell?.dataset.omchhRankEffect).toBe("3");
  });

  it("matches the complete saint-demon group labels from the admin menu", () => {
    const cases = [
      { label: '圣魔王- "傻蛋"', rank: "saint-demon-king", tier: "99", badgeClass: "t-king" },
      { label: "圣魔灵-路西法", rank: "lucifer", tier: "95", badgeClass: "t-spirit" },
      { label: "圣魔使-迪亚波罗", rank: "diablo", tier: "90", badgeClass: "t-envoy" }
    ];

    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist">
          ${cases.map((item, index) => `
            <div id="post_${index + 1}">
              <table id="pid${index + 1}" class="plhin" cellspacing="0" cellpadding="0">
                <tbody>
                  <tr>
                    <td class="pls" rowspan="2">
                      <div id="favatarAdmin${index + 1}" class="pls cl favatar">
                        <div class="pi"><div class="authi"><a class="xw1" href="/space-admin-${index + 1}">admin${index + 1}</a></div></div>
                        <div><div class="avatar"><a class="avtm"><img src="/admin-${index + 1}.jpg" /></a></div></div>
                        <p><em>${item.label}</em></p>
                      </div>
                    </td>
                    <td class="plc"><div class="pi"></div><div class="pct"><div class="pcb"><div class="t_fsz"><table><tbody><tr><td class="t_f">管理组用户。</td></tr></tbody></table></div></div></div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    runAdapters("thread-detail", DEFAULT_SETTINGS);

    cases.forEach((item, index) => {
      const rankNode = document.querySelector<HTMLElement>(`#favatarAdmin${index + 1} > p:not(.xg1):not(.md_ctrl)`);
      const badge = rankNode?.querySelector<HTMLElement>(".omchh-rank-badge");
      expect(rankNode?.dataset.omchhRank).toBe(item.rank);
      expect(rankNode?.dataset.omchhRankFamily).toBe("admin");
      expect(rankNode?.dataset.omchhRankTier).toBe(item.tier);
      expect(rankNode?.dataset.omchhRankEffect).toBe("3");
      expect(rankNode?.dataset.omchhRankBadge).toBe("heraldic");
      expect(rankNode?.getAttribute("aria-label")).toBe(item.label);
      expect(rankNode?.textContent?.trim()).toBe(item.label);
      expect(badge?.classList.contains(item.badgeClass)).toBe(true);
      expect(badge?.querySelector(".bname")?.textContent).toBe(item.label);
    });
  });

  it("uses a neutral heraldic badge for non-ladder rank labels", () => {
    document.body.innerHTML = `
      <div id="ct">
        <div id="postlist">
          <div id="post_1">
            <table id="pid1" class="plhin" cellspacing="0" cellpadding="0">
              <tbody>
                <tr>
                  <td class="pls" rowspan="2">
                    <div id="favatarMerchant" class="pls cl favatar">
                      <div class="pi"><div class="authi"><a class="xw1" href="/space-merchant">店铺号</a></div></div>
                      <div><div class="avatar"><a class="avtm"><img src="/merchant.jpg" /></a></div></div>
                      <p><em>认证商家</em></p>
                    </div>
                  </td>
                  <td class="plc"><div class="pi"></div><div class="pct"><div class="pcb"><div class="t_fsz"><table><tbody><tr><td class="t_f">商家用户。</td></tr></tbody></table></div></div></div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    runAdapters("thread-detail", DEFAULT_SETTINGS);

    const rankNode = document.querySelector<HTMLElement>("#favatarMerchant > p:not(.xg1):not(.md_ctrl)");
    const badge = rankNode?.querySelector<HTMLElement>(".omchh-rank-badge");
    expect(rankNode?.dataset.omchhRank).toBe("other");
    expect(rankNode?.dataset.omchhRankFamily).toBe("other");
    expect(rankNode?.dataset.omchhRankBadge).toBe("heraldic");
    expect(rankNode?.textContent?.trim()).toBe("认证商家");
    expect(badge?.classList.contains("t-other")).toBe(true);
    expect(badge?.querySelector(".bname")?.textContent).toBe("认证商家");
  });

  it("adds semantic hooks for the new-thread compose editor without rebuilding Discuz controls", () => {
    document.body.innerHTML = `
      <form id="postform">
        <div id="ct" class="ct2_a ct2_a_r wp cl">
          <div id="editorbox" class="bm bw0 cl">
            <ul class="tb cl mbw"><li class="a"><a href="javascript:;">发表帖子</a></li></ul>
            <div id="postbox">
              <div class="pbt cl">
                <div class="z"><span><input id="subject" class="px" name="subject" style="width: 25em" /></span><span id="subjectchk">还可输入 <strong id="checklen">80</strong> 个字符</span></div>
              </div>
              <div id="attachnotice_attach" class="tbms mbm xl">您有 <span id="unusednum_attach"></span> 个未使用的附件</div>
              <div id="e_body_loading"><div class="loadicon vm"></div> 请稍后 ...</div>
              <div id="e_body" class="edt">
                <div id="e_controls_mask"></div>
                <div id="e_controls" class="bar">
                  <div class="y"><span class="mbn"><a id="e_fullswitcher" href="javascript:;">全屏</a><a id="e_simple" href="javascript:;">常用</a></span></div>
                  <div id="e_button" class="btn cl">
                    <div id="e_adv_s2" class="b2r nbr nbl"><a id="e_bold" href="javascript:;">B</a><a id="e_url" href="javascript:;">Url</a></div>
                    <div id="e_adv_s1" class="b1r"><a id="e_sml" href="javascript:;">表情</a><a id="e_image" href="javascript:;">图片</a></div>
                  </div>
                </div>
                <div id="rstnotice" class="ntc_l bbs">恢复数据</div>
                <div class="area"><textarea id="e_textarea" name="message" rows="15"></textarea></div>
                <div id="e_bbar" class="bbar"><span id="e_svdsecond">30 秒后保存</span><a id="e_svd" href="javascript:;">保存数据</a></div>
              </div>
              <div id="post_extra" class="ptm cl">
                <div id="post_extra_tb" class="cl"><label id="extra_additional_b"><span id="extra_additional_chk">附加选项</span></label></div>
                <div id="post_extra_c"><div id="extra_additional_c" class="exfm cl"><table><tbody><tr><td><label><input type="checkbox" name="usesig" />使用个人签名</label></td></tr></tbody></table></div></div>
              </div>
              <div id="seccheck"></div>
              <div class="mtm mbm pnpost"><a class="y" href="/rule">本版积分规则</a><button id="postsubmit" class="pn pnc" name="topicsubmit" type="submit"><span>发表帖子</span></button><button class="pn" type="button"><em>保存草稿</em></button></div>
            </div>
          </div>
        </div>
      </form>
    `;

    runAdapters("compose", DEFAULT_SETTINGS);
    runAdapters("compose", DEFAULT_SETTINGS);

    expect(document.querySelector("#ct")?.classList.contains("omchh-compose")).toBe(true);
    expect(document.querySelector("#editorbox")?.classList.contains("omchh-compose-shell")).toBe(true);
    expect(document.querySelector("#postbox")?.classList.contains("omchh-compose-workspace")).toBe(true);
    expect(document.querySelector(".pbt")?.classList.contains("omchh-compose-subject-row")).toBe(true);
    expect(document.querySelector("#subject")?.classList.contains("omchh-compose-title-input")).toBe(true);
    expect(document.querySelector("#e_controls")?.classList.contains("omchh-compose-toolbar")).toBe(true);
    expect(document.querySelector("#e_button")?.classList.contains("omchh-compose-tool-groups")).toBe(true);
    expect(document.querySelectorAll(".omchh-compose-tool-group")).toHaveLength(2);
    expect(document.querySelector("#e_textarea")?.classList.contains("omchh-compose-textarea")).toBe(true);
    expect(document.querySelector("#e_bbar")?.classList.contains("omchh-compose-statusbar")).toBe(true);
    expect(document.querySelector("#post_extra")?.classList.contains("omchh-compose-extra")).toBe(true);
    expect(document.querySelector("#extra_additional_c")?.classList.contains("omchh-compose-extra-panel")).toBe(true);
    expect(document.querySelector(".pnpost")?.classList.contains("omchh-compose-actions")).toBe(true);
    expect(document.querySelector(".pnc")?.getAttribute("data-omchh-compose-action")).toBe("primary");
    expect(document.querySelector("button[type='button']")?.getAttribute("data-omchh-compose-action")).toBe("secondary");
    expect((document.querySelector("#e_textarea") as HTMLTextAreaElement | null)?.value).toBe("");
  });

  it("treats unchecked Discuz switcher as rich mode while the iframe is still booting", () => {
    document.body.innerHTML = `
      <form id="postform">
        <div id="ct" class="ct2_a ct2_a_r wp cl">
          <div id="editorbox" class="bm bw0 cl">
            <div id="postbox">
              <div class="pbt cl"><div class="z"><span><input id="subject" /></span></div></div>
              <div id="e_body" class="edt">
                <div id="e_controls" class="bar">
                  <div class="y"><label id="e_switcher"><input id="e_switchercheck" type="checkbox" />纯文本</label></div>
                  <div id="e_button" class="btn cl"><div id="e_adv_s2" class="b2r"><a id="e_bold" href="javascript:;">B</a></div></div>
                </div>
                <div class="area">
                  <textarea id="e_textarea" name="message" rows="15">draft</textarea>
                  <iframe id="e_iframe" style="display: none; height: 500px;"></iframe>
                </div>
                <div id="e_bbar" class="bbar"></div>
              </div>
              <div class="pnpost"><button class="pn pnc" name="replysubmit" type="submit">发表回复</button></div>
            </div>
          </div>
        </div>
      </form>
    `;

    runAdapters("compose", DEFAULT_SETTINGS);

    expect((document.querySelector("#e_switchercheck") as HTMLInputElement | null)?.checked).toBe(false);
    expect((document.querySelector("#e_body") as HTMLElement | null)?.dataset.omchhComposeMode).toBe("rich");
    expect((document.querySelector("#e_body .area") as HTMLElement | null)?.dataset.omchhComposeMode).toBe("rich");
    expect((document.querySelector("#e_textarea") as HTMLTextAreaElement | null)?.value).toBe("draft");
  });

  it("tracks compose rich/plain panes and fullscreen state without rebuilding Discuz editor nodes", () => {
    document.body.innerHTML = `
      <form id="postform">
        <div id="ct" class="ct2_a ct2_a_r wp cl">
          <div id="editorbox" class="bm bw0 cl">
            <div id="postbox">
              <div class="pbt cl"><div class="z"><span><input id="subject" /></span><span id="subjectchk">还可输入 <strong>80</strong> 个字符</span></div></div>
              <div id="e_body" class="edt">
                <div id="e_controls_mask" style="display: block; height: 52px;"></div>
                <div id="e_controls" class="bar" style="position: fixed; top: 0px; left: 0px; width: 100%; z-index: 500;">
                  <div class="y">
                    <div id="e_adv_5" class="b2r"><p><a id="e_undo" href="javascript:;">Undo</a></p><p><a id="e_redo" href="javascript:;">Redo</a></p></div>
                    <div class="z"><span class="mbn"><a id="e_fullswitcher" href="javascript:;">返回</a><a id="e_simple" href="javascript:;">常用</a></span><label id="e_switcher"><input id="e_switchercheck" type="checkbox" />纯文本</label></div>
                  </div>
                  <div id="e_button" class="btn cl"><div id="e_adv_s2" class="b2r"><a id="e_fontname" href="javascript:;"><span id="e_font">字体</span></a><a id="e_bold" href="javascript:;">B</a></div></div>
                </div>
                <div class="area" style="position: fixed; top: 52px; left: 0px; width: 100%; height: 500px;">
                  <textarea id="e_textarea" name="message" rows="15" style="display: none;"></textarea>
                  <iframe id="e_iframe" style="display: block; height: 500px;"></iframe>
                </div>
                <div id="e_bbar" class="bbar" style="position: fixed; top: 552px; left: 0px; width: 100%;"></div>
              </div>
              <div class="pnpost"><button class="pn pnc" name="topicsubmit" type="submit">发表帖子</button></div>
            </div>
          </div>
        </div>
      </form>
    `;

    runAdapters("compose", DEFAULT_SETTINGS);

    expect(document.querySelector("#e_iframe")?.classList.contains("omchh-compose-wysiwyg")).toBe(true);
    expect(document.querySelector("#e_switcher")?.classList.contains("omchh-compose-mode-switch")).toBe(true);
    expect(document.querySelector("#e_fullswitcher")?.classList.contains("omchh-compose-fullscreen-toggle")).toBe(true);
    expect((document.querySelector("#e_body") as HTMLElement | null)?.dataset.omchhComposeMode).toBe("rich");
    expect((document.querySelector("#e_body .area") as HTMLElement | null)?.dataset.omchhComposeMode).toBe("rich");
    expect(document.body.dataset.omchhComposeFullscreen).toBe("1");

    (document.querySelector("#e_switchercheck") as HTMLInputElement).checked = true;
    (document.querySelector("#e_textarea") as HTMLElement).style.display = "";
    (document.querySelector("#e_iframe") as HTMLElement).style.display = "none";
    (document.querySelector("#e_controls") as HTMLElement).style.position = "";
    (document.querySelector("#e_body .area") as HTMLElement).style.position = "";
    (document.querySelector("#e_bbar") as HTMLElement).style.position = "";

    runAdapters("compose", DEFAULT_SETTINGS);

    expect((document.querySelector("#e_body") as HTMLElement | null)?.dataset.omchhComposeMode).toBe("plain");
    expect(document.body.dataset.omchhComposeFullscreen).toBeUndefined();
    expect((document.querySelector("#e_textarea") as HTMLTextAreaElement | null)?.value).toBe("");
  });

  it("centers visible draggable Discuz popups once while preserving later drag offsets", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="e_editortoolbar">
          <div id="e_vid_menu" class="p_pop" style="position: absolute; display: block; left: 12px; top: 24px; width: 300px; height: 200px; cursor: move;">
            <div class="p_opt"><input id="e_vid_param_1" /></div>
          </div>
        </div>
      </div>
    `;

    runAdapters("unknown", DEFAULT_SETTINGS);

    const popup = document.querySelector<HTMLElement>("#e_vid_menu");
    expect(popup?.classList.contains("omchh-popup-surface")).toBe(true);
    expect(popup?.dataset.omchhPopupCentered).toBe("1");
    expect(popup?.style.left).toBe(`${Math.round((window.innerWidth - 300) / 2 + window.scrollX)}px`);
    expect(popup?.style.top).toBe(`${Math.round((window.innerHeight - 200) / 2 + window.scrollY)}px`);

    popup!.style.left = "88px";
    popup!.style.top = "96px";

    runAdapters("unknown", DEFAULT_SETTINGS);

    expect(popup?.style.left).toBe("88px");
    expect(popup?.style.top).toBe("96px");
  });


  it("centers oversized forum reply windows using their viewport-constrained size", () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { value: 1073, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 659, configurable: true });

    try {
      document.body.innerHTML = `
        <div id="append_parent">
          <div id="fwin_reply" class="fwinmask" style="position: absolute; display: block; left: 12px; top: 24px; width: 760px; height: 700px;">
            <table class="fwin" style="width: 760px;"><tbody><tr><td class="m_c"><div id="fwin_content_reply">参与/回复主题</div></td></tr></tbody></table>
          </div>
        </div>
        <div id="wp"><div id="ct"></div></div>
      `;

      runAdapters("thread-detail", DEFAULT_SETTINGS);

      const popup = document.querySelector<HTMLElement>("#fwin_reply");
      expect(popup?.classList.contains("omchh-popup-surface")).toBe(true);
      expect(popup?.dataset.omchhPopupCentered).toBe("1");
      expect(popup?.style.getPropertyValue("--omchh-popup-max-width")).toBe("720px");
      expect(popup?.style.getPropertyValue("--omchh-popup-max-height")).toBe("631px");
      expect(popup?.style.left).toBe(`${Math.round((1073 - 720) / 2)}px`);
      expect(popup?.style.top).toBe("14px");
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
    }
  });

  it("adds a collapsible sticky-topic card without moving pinned thread rows", () => {
    document.body.innerHTML = `
      <div id="wp">
        <div id="ct">
          <div id="threadlist">
            <table id="threadlisttableid">
              <tbody><tr><td class="icn">notice</td><th>公告: Chiphell社区积分等级规则2013版.</th><td class="by">nApoleon</td><td class="num">&nbsp;</td><td class="by">&nbsp;</td></tr></tbody>
              <tbody id="stickthread_1"><tr><td class="icn">lock</td><th class="lock"><a class="closeprev y" href="javascript:void(0);" onclick="hideStickThread('1')" title="隐藏置顶帖">隐藏置顶帖</a><a class="s xst" href="/thread-1-1-1.html">置顶主题一</a></th><td class="by">作者 A</td><td class="num">0/100</td><td class="by">最后 A</td></tr></tbody>
              <tbody id="stickthread_2"><tr><td class="icn">digest</td><th class="common"><a class="s xst" href="/thread-2-1-1.html">置顶主题二</a></th><td class="by">作者 B</td><td class="num">1/200</td><td class="by">最后 B</td></tr></tbody>
              <tbody id="separatorline"><tr class="ts"><td>&nbsp;</td><th>&nbsp;</th><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody>
              <tbody id="normalthread_3"><tr><td class="icn">new</td><th class="new"><a href="/thread-3-1-1.html">普通主题</a></th><td class="by">作者 C</td><td class="num">3/300</td><td class="by">最后 C</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    runAdapters("thread-list", DEFAULT_SETTINGS);
    runAdapters("thread-list", DEFAULT_SETTINGS);

    const table = document.querySelector<HTMLTableElement>("#threadlisttableid");
    const childKeys = Array.from(table?.children ?? []).map((child) => child.id || (child as HTMLElement).dataset.omchhStickyCard || child.tagName);
    expect(childKeys).toEqual(["TBODY", "header", "stickthread_1", "stickthread_2", "separatorline", "normalthread_3"]);

    const stickyRows = Array.from(table?.children ?? []).filter((child) => child.id.startsWith("stickthread_")) as HTMLElement[];
    expect(stickyRows).toHaveLength(2);
    expect(stickyRows.map((row) => row.getAttribute("data-omchh-thread-kind"))).toEqual(["sticky", "sticky"]);
    expect(stickyRows.map((row) => row.hidden)).toEqual([false, false]);
    expect(document.querySelectorAll(".omchh-thread-sticky-card")).toHaveLength(1);
    expect(document.querySelector(".omchh-thread-sticky-count")?.textContent).toContain("2");

    const button = document.querySelector<HTMLButtonElement>(".omchh-thread-sticky-toggle");
    expect(button?.getAttribute("aria-controls")).toBe("threadlisttableid");
    expect(button?.getAttribute("aria-expanded")).toBe("true");

    button?.click();
    expect(table?.getAttribute("data-omchh-sticky-card-collapsed")).toBe("true");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(stickyRows.map((row) => row.hidden)).toEqual([true, true]);
    expect(stickyRows.map((row) => row.id)).toEqual(["stickthread_1", "stickthread_2"]);

    button?.click();
    expect(table?.getAttribute("data-omchh-sticky-card-collapsed")).toBe("false");
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(stickyRows.map((row) => row.hidden)).toEqual([false, false]);
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
