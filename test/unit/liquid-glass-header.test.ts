import { afterEach, describe, expect, it } from "vitest";
import { enhanceLiquidGlassHeader } from "../../src/theming/themes/liquid-glass/adapter/header";
import { EnhancementScope } from "../../src/platform/enhancement-scope";
import { DEFAULT_SETTINGS } from "../../src/preferences/settings";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("data-omchh-liquid-header-ready");
  document.documentElement.removeAttribute("data-chh-lg-scrolled");
  document.documentElement.classList.remove("chh-liquid-glass");
  document.body.classList.remove("chh-liquid-glass");
});

function renderHeaderFixture(): void {
  document.body.innerHTML = `
    <div id="toptb"></div>
    <div id="hd">
      <div class="hdc">
        <h2><a href="/">Chiphell</a></h2>
        <div id="um">
          <div class="avt"><a href="/space-uid-444265.html"><img class="user_avatar" src="avatar.png" alt=""></a></div>
          <p>
            <strong class="vwmy"><a href="/space-uid-444265.html">zzNaLogic</a></strong>
            <span class="pipe">|</span><a href="javascript:;" id="myitem" class="showmenu">我的</a>
            <span class="pipe">|</span><a href="/home.php?mod=space&do=pm" id="pm_ntc">消息</a>
            <span class="pipe">|</span><a href="/home.php?mod=space&do=notice" id="myprompt" class="a showmenu">提醒</a>
          </p>
          <p>
            <a href="/home.php?mod=spacecp&ac=credit&showcredit=1" id="extcreditmenu" class="showmenu">积分: 286</a>
            <span class="pipe">|</span><a href="/home.php?mod=spacecp&ac=usergroup" id="g_upmine" class="showmenu">用户组: 天使</a>
          </p>
        </div>
      </div>
    </div>
    <div id="nv_ph">
      <div id="nv">
        <a href="javascript:;" id="qmenu">快捷导航</a>
        <ul><li><a href="/">首页</a></li><li><a href="/forum.php">社区</a></li></ul>
      </div>
    </div>
    <div id="scbar"></div>
  `;
}

describe("liquid-glass header account panel", () => {
  it("renders the header user group link with the shared heraldic rank badge", () => {
    renderHeaderFixture();

    enhanceLiquidGlassHeader({ root: document, route: "thread-detail", settings: DEFAULT_SETTINGS }, new EnhancementScope());

    const groupLink = document.querySelector<HTMLAnchorElement>("#chh-lg-header #g_upmine");
    const badge = groupLink?.querySelector<HTMLElement>(":scope > .omchh-rank-badge");
    const badgeName = badge?.querySelector<HTMLElement>(":scope > .bname");

    expect(groupLink).not.toBeNull();
    expect(groupLink?.dataset.omchhRankBadge).toBe("heraldic");
    expect(groupLink?.dataset.omchhRank).toBe("angel");
    expect(groupLink?.dataset.omchhRankFamily).toBe("angel");
    expect(groupLink?.getAttribute("aria-label")).toBe("用户组: 天使");
    expect(groupLink?.getAttribute("title")).toBe("用户组: 天使");
    expect(groupLink?.textContent?.replace(/\s+/g, " ").trim()).toBe("天使");
    expect(badge?.classList.contains("t-angel")).toBe(true);
    expect(badge?.classList.contains("fx-orbit")).toBe(true);
    expect(badgeName?.textContent).toBe("天使");
    expect(document.querySelector("#extcreditmenu")?.textContent).toBe("积分: 286");
  });
});
