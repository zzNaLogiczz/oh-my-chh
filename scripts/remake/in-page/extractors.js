// remakeweb：页面解析规则（Discuz X3.5 DOM → 结构化数据）
// 设计原则：
//   1. 每个路由一个自包含提取函数，运行在页面上下文（无任何外部依赖）
//   2. 选择器多路回退 + 容错：任何字段缺失不抛错，返回 null/[]
//   3. 输出统一 JSON：字段语义固定，供后续 Spectrum 重绘层直接消费
// 命名约定：*_url 一律绝对地址；*_html 保留原始富文本；其余为纯文本
// 注意：规则针对 chiphell 原始 DOM（Discuz X3.5），已在登录态实测校准。

(function () {
  const ABS = (u) => {
    if (!u) return null;
    try { return new URL(u, document.baseURI).href; } catch { return null; }
  };
  const TXT = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
  const INT = (s) => {
    if (s == null) return null;
    const m = String(s).replace(/,/g, "").match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  };
  const A_HREF = (el) => (el ? ABS(el.getAttribute("href")) : null);
  const uidFromUrl = (u) => {
    const m = String(u || "").match(/uid[=-](\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };
  const tidFromUrl = (u) => {
    const m = String(u || "").match(/(?:thread-(\d+)-|tid=(\d+))/);
    return m ? parseInt(m[1] || m[2], 10) : null;
  };
  const q = (sel, root) => (root || document).querySelector(sel);
  const qa = (sel, root) => [...(root || document).querySelectorAll(sel)];

  const extractors = {

    /* ============ 门户首页 portal-home ============ */
    "portal-home": () => {
      const listItems = (sel) =>
        qa(sel)
          .filter((a) => a.tagName === "A" && TXT(a))
          .map((a) => ({ title: TXT(a), url: A_HREF(a) }));
      return {
        route: "portal-home",
        url: location.href,
        news: listItems("#portal_block_673 .acon li a"),                      // 快讯
        hot: qa("#portal_block_672 .swiper-slide").map((s) => {
          const a = q("a", s) || s;
          const img = q("img", s);
          return {
            title: s.getAttribute("data-chh-lg-title") || TXT(a) || (img ? img.alt : null),
            url: A_HREF(a),
            image: img ? ABS(img.src) : null,
          };
        }).filter((x) => x.title),
        reviews: qa(".chip_index_cps .acon li").map((li) => {
          const a = q("a[title]", li) || q("a", li);
          const img = q("img", li);
          return {
            title: (a ? (a.getAttribute("title") || TXT(a)) : null) || (img ? img.alt : null) || TXT(li),
            url: A_HREF(a),
            image: img ? ABS(img.src) : null,
          };
        }).filter((x) => x.title),
        culture: listItems("#portal_block_671 a").filter((x) => !/文化$/.test(x.title)),   // 文化
        topics: listItems("#portal_block_674 a").filter((x) => !/专题$/.test(x.title)),    // 专题
        blocks: qa("[id^='portal_block_']").map((b) => ({
          id: b.id,
          title: TXT(q(".blocktitle, .titletext, .atit", b)),
        })).filter((b) => b.title),
      };
    },

    /* ============ 论坛首页 forum-index ============ */
    "forum-index": () => {
      const cleanName = (s) => (s || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
      return {
        route: "forum-index",
        url: location.href,
        categories: qa("#ct .bm").map((cat) => ({
          name: cleanName(TXT(q("h2", cat))),
          forums: qa("table.fl_tb tbody tr", cat).map((tr) => {
            const nameA = q("h2 a", tr) || q(".fl_g a", tr) || q("td:nth-child(2) a", tr);
            const tds = qa("td", tr);
            const nums = (TXT(tds[1]) || "").match(/\d+/g) || [];
            const last = q("td.fl_by, td:last-child", tr);
            const lastA = last ? q("a", last) : null;
            return {
              name: nameA ? cleanName(TXT(nameA)) : null,
              url: A_HREF(nameA),
              icon: (() => { const i = q("td.fl_icn img", tr); return i ? ABS(i.src) : null; })(),
              threads: INT(nums[0]),
              posts: INT(nums[1]),
              lastPost: lastA ? { title: TXT(lastA), url: A_HREF(lastA) } : null,
              lastPostTime: TXT(q("em", last || tr)),
            };
          }).filter((f) => f.name),
        })).filter((c) => c.name),
      };
    },

    /* ============ 帖子列表 thread-list ============ */
    "thread-list": () => {
      const rows = qa("#threadlist tbody[id]");
      const threads = [];
      const seen = new Set();
      for (const tb of rows) {
        const idm = (tb.id || "").match(/normalthread_(\d+)|stickthread_(\d+)/);
        if (!idm) continue;
        const tid = parseInt(idm[1] || idm[2], 10);
        if (seen.has(tid)) continue;
        seen.add(tid);
        const titleA = q("a.xst", tb) || q("th a", tb);
        const author = q("cite a", tb);
        const numTd = q("td.num", tb);
        const repliesA = q("a.xi2", numTd);
        const viewsEm = q("em", numTd);
        const lastTd = q("td.last, td:last-child", tb);
        const lastA = lastTd ? q("em a", lastTd) : null;
        threads.push({
          tid,
          title: titleA ? TXT(titleA) : null,
          url: titleA ? A_HREF(titleA) : null,
          pinned: /stickthread/.test(tb.id),
          author: author ? { name: TXT(author), url: A_HREF(author), uid: uidFromUrl(A_HREF(author)) } : null,
          replies: repliesA ? INT(repliesA.textContent) : (numTd ? INT(numTd.textContent) : null),
          views: viewsEm ? INT(viewsEm.textContent) : null,
          lastPost: lastA ? { title: TXT(lastA), url: A_HREF(lastA) } : null,
          lastPostTime: TXT(q("em span, em", lastTd || tb)),
        });
      }
      const h1A = q("#ct h1 a");
      return {
        route: "thread-list",
        url: location.href,
        forum: { name: TXT(h1A), url: A_HREF(h1A) },
        filter: TXT(q("#filter_special")),
        subforums: qa("#subforums a, .bm_c .sblue a").map((a) => ({ name: TXT(a), url: A_HREF(a) })),
        threads,
        pagination: (() => {
          const pg = q(".pg, .pgs");
          if (!pg) return { current: 1, pages: [] };
          return {
            current: INT(TXT(q("strong", pg))) ?? 1,
            pages: qa("a", pg).map((a) => ({ label: TXT(a), url: A_HREF(a) })),
          };
        })(),
      };
    },

    /* ============ 帖子详情 thread-detail ============ */
    "thread-detail": () => {
      const posts = qa("#postlist div[id^='post_']").map((pd) => {
        const pid = (pd.id || "").replace("post_", "");
        const authorA = q(".pls .authi a.xw1, .pls .authi a", pd);
        const avatar = q(".pls .avatar img, .pls img.avt, .pls img", pd);
        const contentEl = q(".pct .pct_cb, .pct td.t_f, td.t_f, .pct", pd);
        const floorEl = q(".plc .pi strong a em, .pi strong em", pd);
        const timeEl = q(".authi em, .pti .authi em", pd);
        const images = qa("img", contentEl).map((i) => ABS(i.src)).filter((u) => u && !/smiley|smilies|none\.gif/.test(u));
        return {
          pid: INT(pid),
          floor: INT(TXT(floorEl)),
          author: {
            name: authorA ? TXT(authorA) : TXT(q(".pls .authi", pd)),
            url: A_HREF(authorA),
            avatar: avatar ? ABS(avatar.src) : null,
            uid: uidFromUrl(A_HREF(authorA)),
          },
          time: TXT(timeEl),
          contentHtml: contentEl ? contentEl.innerHTML.trim() : null,
          contentText: contentEl ? TXT(contentEl) : null,
          images,
          attachments: qa(".pattl .attachnew, .pattl dl", pd).map((a) => ({
            title: TXT(q("em, .xs0", a)) || TXT(a),
            url: A_HREF(q("a", a)),
          })),
          signature: TXT(q(".sign", pd)),
        };
      });
      return {
        route: "thread-detail",
        url: location.href,
        tid: tidFromUrl(location.href),
        title: TXT(q("#thread_subject")) || TXT(q("h1.ts span")) || document.title.split(" - ")[0],
        forum: (() => {
          const crumbs = qa("#pt .z a, #pt .z");
          const last = crumbs[crumbs.length - 1];
          return { name: TXT(last), url: A_HREF(last) };
        })(),
        breadcrumb: qa("#pt .z a").map((a) => ({ name: TXT(a), url: A_HREF(a) })),
        views: INT((TXT(q("#thread_views")) || "").replace(/\D/g, "")),
        replies: INT((TXT(q("#thread_replies")) || "").replace(/\D/g, "")),
        posts,
        pagination: (() => {
          const pg = q(".pg, .pgs");
          return pg ? {
            current: INT(TXT(q("strong", pg))) ?? 1,
            pages: qa("a", pg).map((a) => ({ label: TXT(a), url: A_HREF(a) })),
          } : null;
        })(),
      };
    },

    /* ============ 消息（私信） messages ============
       行结构：dl[id^=pmlist_<uid>] — 按对端用户聚合的会话
       dd.m.avt：头像（.newpm_avt = 未读标记）；dd.pm_c：内容
       方向：span.xi2.xw1 为「您」= 发出；否则为收到
       时间：span.xg1                                    */
    "messages": () => {
      const rows = qa("#ct dl[id^='pmlist_'], .pml[id^='pmlist_']");
      const conversations = rows.map((dl) => {
        const avtA = q("dd.m.avt a", dl);
        const peerA = q("dd.pm_c a[href*='space-uid']", dl);
        const directionSpan = q("dd.pm_c span.xi2.xw1", dl);
        const outgoing = directionSpan ? TXT(directionSpan) === "您" : null;
        const timeEl = q("dd.pm_c span.xg1", dl);
        const unread = !!q("dd.m.avt .newpm_avt", dl);
        const clone = q("dd.pm_c", dl)?.cloneNode(true);
        if (clone) {
          qa(".o, .xg1, span.xi2", clone).forEach((n) => n.remove());
        }
        return {
          peer: peerA ? { name: TXT(peerA), uid: uidFromUrl(A_HREF(peerA)), url: A_HREF(peerA) } : null,
          avatar: (() => { const i = q("dd.m.avt img", dl); return i ? ABS(i.src) : null; })(),
          direction: outgoing ? "out" : "in",
          preview: clone ? TXT(clone) : TXT(dl),
          time: timeEl ? TXT(timeEl) : null,
          unread,
        };
      }).filter((c) => c.peer);
      return {
        route: "messages",
        url: location.href,
        tabs: qa(".tb a, ul.tb li a").map((a) => ({ label: TXT(a), url: A_HREF(a), active: /class="a"/.test(a.parentElement?.className ?? "") })),
        conversations,
      };
    },

    /* ============ 通知 notice ============ */
    "notifications": () => ({
      route: "notifications",
      url: location.href,
      notices: qa("#ct li, #ntlist li, .ntc li").map((li) => {
        const a = q("a", li);
        return { text: TXT(li).slice(0, 200), url: A_HREF(a), unread: /new/.test(li.className) };
      }).filter((x) => x.text),
      rawText: (TXT(q("#ct")) || "").slice(0, 2000),
    }),

    /* ============ 设置 spacecp ============ */
    "settings": () => ({
      route: "settings",
      url: location.href,
      username: TXT(q("#um strong a, strong.vwmy a")),
      navSections: qa(".omchh-side-nav a, #ct .ul_ct a, .appl li a").map((a) => ({ name: TXT(a), url: A_HREF(a) })),
      formFields: qa("#ct input[name], #ct select[name], #ct textarea[name]").map((i) => ({
        name: i.name,
        type: i.tagName === "INPUT" ? i.type : i.tagName.toLowerCase(),
        value: i.type === "checkbox" ? String(i.checked) : String(i.value ?? "").slice(0, 60),
      })).filter((f) => f.type !== "hidden"),
      rawText: (TXT(q("#ct")) || "").slice(0, 1500),
    }),

    /* ============ 个人主页 space profile ============ */
    "profile": () => ({
      route: "profile",
      url: location.href,
      username: TXT(q(".h_name, #h1, h2.ph, .mt span")),
      uid: uidFromUrl(location.href),
      avatar: (() => { const i = q("#hm .avt img, .h_money img, #ct .avatar img"); return i ? ABS(i.src) : null; })(),
      stats: qa("#pbbs td, .pf_l td, #ct td").map((td) => TXT(td)).filter(Boolean).slice(0, 12),
      fields: qa("#pprl dl, #ct dl").map((dl) => ({ label: TXT(q("dt", dl)), value: TXT(q("dd", dl)) })).filter((f) => f.label),
      rawText: (TXT(q("#ct")) || "").slice(0, 1500),
    }),

    /* ============ 发帖页 compose（结构探测，写操作后续专项） ============ */
    "compose": () => ({
      route: "compose",
      url: location.href,
      hasEditor: !!q("#e_textarea, #e_iframe, .area"),
      subjectInput: !!q("input[name='subject']"),
      formAction: (q("#postform") ? q("#postform").getAttribute("action") : null),
      formhash: (q("input[name='formhash']") ? q("input[name='formhash']").value : null),
      rawText: (TXT(q("#ct")) || "").slice(0, 800),
    }),
  };

  window.__remakeExtractors = extractors;
})();
