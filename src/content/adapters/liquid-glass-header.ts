import type { ContentAdapter } from "./types";

const HEADER_READY_ATTR = "data-omchh-liquid-header-ready";
const QUICK_MENU_BOUND_ATTR = "data-omchh-liquid-qmenu-bound";
const NAV_PILL_BOUND_ATTR = "data-chh-lg-pill-bound";
const NAV_HOVER_ATTR = "data-chh-lg-nav-hover";
const HEADER_ID = "chh-lg-header";
const NAV_ACTIVE_ATTR = "data-chh-lg-active";

let pointerScheduled = false;
let globalStateBound = false;
let lastPointer = { x: "50vw", y: "12vh" };

function makeNode<K extends keyof HTMLElementTagNameMap>(tagName: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function decorateAccountLinks(accountRoot: Element | null): void {
  if (!accountRoot || accountRoot.getAttribute("data-chh-lg-account-ready") === "true") return;
  accountRoot.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    const text = link.textContent?.replace(/\s+/g, " ").trim();
    if (text) link.dataset.chhLgLabel = text;
  });
  accountRoot.setAttribute("data-chh-lg-account-ready", "true");
}

function rebuildBrandRail(headerInner: HTMLElement): void {
  if (headerInner.getAttribute("data-chh-lg-brand-ready") === "true") return;

  const logoHeading = headerInner.querySelector("h2");
  const account = headerInner.querySelector("#um");

  if (logoHeading?.parentNode) {
    const brandLockup = makeNode("div", "chh-lg-brand-lockup");
    const brandCopy = makeNode("div", "chh-lg-brand-copy");
    const brandTitle = makeNode("strong", "chh-lg-brand-title", "Chiphell");
    const brandSub = makeNode("span", "chh-lg-brand-subtitle", "分享与交流用户体验");

    logoHeading.parentNode.insertBefore(brandLockup, logoHeading);
    brandLockup.append(logoHeading);
    brandCopy.append(brandTitle, brandSub);
    brandLockup.append(brandCopy);
  }

  if (account?.parentNode) {
    const accountPanel = makeNode("div", "chh-lg-account-panel");
    account.parentNode.insertBefore(accountPanel, account);
    accountPanel.append(account);
    decorateAccountLinks(account);
  }

  headerInner.setAttribute("data-chh-lg-brand-ready", "true");
}

function getOrCreateNavWrap(): HTMLElement | null {
  const existingWrap = document.querySelector<HTMLElement>("#nv_ph");
  if (existingWrap) return existingWrap;

  const nav = document.querySelector<HTMLElement>("#nv");
  if (!nav?.parentNode) return null;

  const createdWrap = makeNode("div", "chh-lg-created-nav-wrap");
  createdWrap.id = "nv_ph";
  createdWrap.dataset.chhLgCreated = "true";
  nav.parentNode.insertBefore(createdWrap, nav);
  createdWrap.append(nav);

  return createdWrap;
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function cleanupCommunityLabel(): void {
  document.querySelectorAll<HTMLAnchorElement>("#nv a").forEach((link) => {
    const badgeSpans = [...link.querySelectorAll<HTMLSpanElement>("span")].filter((span) => /^bbs$/i.test(normalizeText(span.textContent)));
    if (!badgeSpans.length) return;
    if (!normalizeText(link.textContent).startsWith("社区")) return;

    badgeSpans.forEach((span) => span.remove());
    if (/^bbs$/i.test(normalizeText(link.getAttribute("title")))) link.removeAttribute("title");
  });
}

function navItems(): HTMLLIElement[] {
  const list = document.querySelector<HTMLElement>("#nv > ul");
  if (!list) return [];
  return [...list.children].filter((child): child is HTMLLIElement => child instanceof HTMLLIElement);
}

function directNavLink(item: HTMLLIElement): HTMLAnchorElement | null {
  return [...item.children].find((child): child is HTMLAnchorElement => child instanceof HTMLAnchorElement) ?? null;
}

function bodyHas(...tokens: string[]): boolean {
  const body = document.body;
  if (!body) return false;
  return tokens.every((token) => body.classList.contains(token) || body.id === token);
}

function scoreNavLink(link: HTMLAnchorElement, currentUrl: URL): number {
  const rawHref = link.getAttribute("href");
  if (!rawHref || rawHref.startsWith("javascript:")) return -1;

  let linkUrl: URL;
  try {
    linkUrl = new URL(rawHref, currentUrl.href);
  } catch {
    return -1;
  }

  if (linkUrl.hostname && linkUrl.hostname !== currentUrl.hostname) return -1;
  if (linkUrl.pathname === currentUrl.pathname && linkUrl.search === currentUrl.search) return 100;

  const currentCatId = currentUrl.searchParams.get("catid");
  const linkCatId = linkUrl.searchParams.get("catid");
  if (currentUrl.pathname === "/portal.php" && linkUrl.pathname === "/portal.php" && currentCatId && linkCatId === currentCatId) {
    return 95;
  }

  if ((currentUrl.pathname === "/" || (currentUrl.pathname === "/portal.php" && !currentCatId && bodyHas("nv_portal", "pg_index"))) && linkUrl.pathname === "/") {
    return 90;
  }

  if (currentUrl.pathname === "/forum.php" && linkUrl.pathname === "/forum.php") return 90;
  if (bodyHas("nv_forum") && linkUrl.pathname === "/forum.php") return 80;

  return -1;
}

function syncNavActiveState(): void {
  const items = navItems();
  if (!items.length) return;

  const currentUrl = new URL(window.location.href);
  const scored = items
    .map((item) => ({ item, link: directNavLink(item) }))
    .map(({ item, link }) => ({ item, link, score: link ? scoreNavLink(link, currentUrl) : -1 }))
    .sort((a, b) => b.score - a.score);

  const matched = scored[0]?.score >= 0 ? scored[0] : null;
  const existing = scored.find(({ item }) => item.classList.contains("a"));
  const active = matched ?? existing;
  if (!active) return;

  items.forEach((item) => {
    item.classList.remove("a");
    item.removeAttribute(NAV_ACTIVE_ATTR);
    directNavLink(item)?.removeAttribute("aria-current");
  });

  active.item.classList.add("a");
  active.item.setAttribute(NAV_ACTIVE_ATTR, "true");
  active.link?.setAttribute("aria-current", "page");
}

function buildHeaderShell(): void {
  if (document.documentElement.hasAttribute(HEADER_READY_ATTR)) return;

  const topbar = document.querySelector<HTMLElement>("#toptb");
  const header = document.querySelector<HTMLElement>("#hd");
  const headerInner = header?.querySelector<HTMLElement>(".hdc") ?? null;
  const navWrap = getOrCreateNavWrap();
  const searchBar = document.querySelector<HTMLElement>("#scbar");

  if (!topbar || !header || !headerInner || !navWrap || !searchBar || !topbar.parentNode) return;

  const shell = makeNode("section", "chh-lg-header-shell");
  shell.id = HEADER_ID;
  shell.setAttribute("aria-label", "Chiphell header");

  const glass = makeNode("div", "chh-lg-header-glass");
  const topRail = makeNode("div", "chh-lg-top-rail");
  const brandRail = makeNode("div", "chh-lg-brand-rail");
  const navRail = makeNode("div", "chh-lg-nav-rail");

  topbar.parentNode.insertBefore(shell, topbar);
  shell.append(glass);
  glass.append(topRail, brandRail, navRail);
  topRail.append(topbar);
  brandRail.append(header);
  navRail.append(navWrap, searchBar);

  rebuildBrandRail(headerInner);
  document.documentElement.setAttribute(HEADER_READY_ATTR, "true");
}

function relocateHeaderMenus(): void {
  if (!document.body) return;

  const selectors = [
    ".p_pop[id$='_menu']",
    ".h_pop[id$='_menu']",
    "#qmenu_menu",
    "#scbar_type_menu",
    "#myprompt_menu",
    "#myitem_menu"
  ];
  const seen = new Set<string>();

  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((menu) => {
      if (!menu.id || seen.has(menu.id)) return;
      seen.add(menu.id);
      menu.dataset.chhLgMenuLayer = "root";
      if (menu.parentElement !== document.body) document.body.append(menu);
    });
  });
}

function clampQuickMenu(): void {
  const menu = document.querySelector<HTMLElement>("#qmenu_menu");
  if (!menu || menu.style.display === "none") return;

  const inset = 16;
  const rect = menu.getBoundingClientRect();
  let nextLeft = rect.left;

  if (rect.right > window.innerWidth - inset) nextLeft = Math.max(inset, window.innerWidth - rect.width - inset);
  if (nextLeft < inset) nextLeft = inset;

  if (Math.abs(nextLeft - rect.left) > 1) menu.style.left = String(Math.round(nextLeft + window.scrollX)) + "px";
}

function scheduleQuickMenuClamp(): void {
  window.requestAnimationFrame(() => {
    clampQuickMenu();
    window.setTimeout(clampQuickMenu, 80);
  });
}

function bindQuickMenuPlacement(): void {
  const trigger = document.querySelector<HTMLElement>("#qmenu");
  const menu = document.querySelector<HTMLElement>("#qmenu_menu");
  if (!trigger || !menu || trigger.getAttribute(QUICK_MENU_BOUND_ATTR) === "true") return;

  trigger.addEventListener("pointerenter", scheduleQuickMenuClamp, { passive: true });
  trigger.addEventListener("focus", scheduleQuickMenuClamp);
  trigger.addEventListener("click", scheduleQuickMenuClamp);

  const menuObserver = new MutationObserver(scheduleQuickMenuClamp);
  menuObserver.observe(menu, {
    attributes: true,
    attributeFilter: ["style", "class"],
    childList: true,
    subtree: true
  });

  trigger.setAttribute(QUICK_MENU_BOUND_ATTR, "true");
}


function syncLiquidGlassClass(): void {
  document.documentElement.classList.add("chh-liquid-glass");
  document.body?.classList.add("chh-liquid-glass");
}

function markPromoArea(): void {
  const frame = document.querySelector<HTMLElement>(".frame.move-span.cl");
  if (frame && !frame.hasAttribute("data-chh-lg-promo")) frame.setAttribute("data-chh-lg-promo", "true");

  const diyStyle = document.getElementById("diy_style");
  if (diyStyle) diyStyle.setAttribute("media", "not all");

  const portalBlock34 = document.getElementById("portal_block_34") as HTMLElement | null;
  if (portalBlock34) {
    portalBlock34.style.border = "";
    portalBlock34.style.marginRight = "";
  }

  const portalBlock676 = document.getElementById("portal_block_676") as HTMLElement | null;
  if (portalBlock676) portalBlock676.style.marginLeft = "";

  document
    .querySelectorAll<HTMLElement>(
      "#portal_block_34 .blocktitle .titletext, " +
        "#portal_block_34 .blocktitle .titletext a, " +
        "#portal_block_676 .blocktitle .titletext, " +
        "#portal_block_676 .acon font"
    )
    .forEach((title) => title.removeAttribute("style"));

  enhancePromoSlider();
}

function enhanceForumDirectory(): void {
  document.querySelectorAll<HTMLElement>("#ct .bmw.flg").forEach((group, groupIndex) => {
    group.setAttribute("data-chh-lg-forum-section", String(groupIndex + 1));

    const collapse = group.querySelector<HTMLElement>(".bm_h .o");
    if (collapse) collapse.setAttribute("aria-hidden", "true");

    group.querySelectorAll<HTMLElement>(".bm_h h2 a, .fl_g dt a").forEach((link) => link.removeAttribute("style"));
    group.querySelectorAll<HTMLElement>("td.fl_g").forEach((card) => card.setAttribute("data-chh-lg-forum-card", "true"));
  });
}

function enhanceFooterRail(): void {
  const footer = document.querySelector<HTMLElement>("#ft");
  if (footer) {
    footer.setAttribute("data-chh-lg-footer", "true");

    footer.querySelectorAll<HTMLAnchorElement>("#flk a[style]").forEach((link) => {
      link.setAttribute("data-chh-lg-footer-badge", "true");
      link.style.width = "";
      link.style.height = "";
      link.style.removeProperty("zoom");
    });

    footer.querySelectorAll<HTMLImageElement>("img").forEach((image) => image.removeAttribute("border"));

    const flkFirst = footer.querySelector<HTMLElement>("#flk p:first-child");
    if (flkFirst) {
      [...flkFirst.childNodes].forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) return;
        node.textContent = (node.textContent ?? "").replace(/\s*[()\s]+\s*/g, " ").trim();
        if (node.textContent === "") node.parentNode?.removeChild(node);
      });
    }
  }

  const actionRail = document.querySelector<HTMLElement>("#scrolltop");
  if (actionRail) {
    actionRail.setAttribute("data-chh-lg-action-rail", "true");
    actionRail.removeAttribute("style");

    const topLink = actionRail.querySelector<HTMLAnchorElement>("a.scrolltopa");
    if (topLink) topLink.setAttribute("aria-label", "返回顶部");
  }
}

function enhancePromoSlider(): void {
  document.querySelectorAll<HTMLElement>("#portal_block_34 .slidebox").forEach((slidebox) => {
    const slidebar = slidebox.querySelector<HTMLElement>(".slidebar");
    const count = slidebar?.querySelectorAll("li").length ?? 0;
    if (!slidebar || slidebox.getAttribute("data-chh-lg-slider-count") === String(count)) return;

    slidebox.querySelectorAll(".chh-lg-slide-nav").forEach((button) => button.remove());
    slidebar.setAttribute("aria-hidden", "true");
    slidebox.setAttribute("data-chh-lg-slider-count", String(count));
    if (count <= 1) return;

    const previous = makeNode("button", "chh-lg-slide-nav chh-lg-slide-nav--prev");
    const next = makeNode("button", "chh-lg-slide-nav chh-lg-slide-nav--next");
    previous.type = "button";
    next.type = "button";
    previous.setAttribute("aria-label", "上一张评测");
    next.setAttribute("aria-label", "下一张评测");

    bindPromoSlideButton(previous, slidebox, -1);
    bindPromoSlideButton(next, slidebox, 1);
    slidebox.append(previous, next);
  });
}

function bindPromoSlideButton(button: HTMLButtonElement, slidebox: HTMLElement, direction: number): void {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    movePromoSlide(slidebox, direction);
  });
}

function movePromoSlide(slidebox: HTMLElement, direction: number): void {
  const items = [...slidebox.querySelectorAll<HTMLElement>(".slidebar li")];
  if (items.length <= 1) return;

  const activeIndex = Math.max(0, items.findIndex((item) => item.classList.contains("on")));
  const nextItem = items[(activeIndex + direction + items.length) % items.length];
  const mouseEvent = new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window });

  if (typeof nextItem.onmouseover === "function") nextItem.onmouseover.call(nextItem, mouseEvent);
  else nextItem.dispatchEvent(mouseEvent);

  items.forEach((item) => item.classList.remove("on"));
  nextItem.classList.add("on");
}

function syncScrollState(): void {
  document.documentElement.toggleAttribute("data-chh-lg-scrolled", window.scrollY > 8);
}

function syncPointerState(): void {
  pointerScheduled = false;
  document.documentElement.style.setProperty("--chh-lg-pointer-x", lastPointer.x);
  document.documentElement.style.setProperty("--chh-lg-pointer-y", lastPointer.y);
  document.documentElement.style.setProperty("--chh-pointer-x", lastPointer.x);
  document.documentElement.style.setProperty("--chh-pointer-y", lastPointer.y);
}

function schedulePointerState(event: PointerEvent): void {
  lastPointer = {
    x: String(event.clientX) + "px",
    y: String(event.clientY) + "px"
  };
  if (pointerScheduled) return;
  pointerScheduled = true;
  window.requestAnimationFrame(syncPointerState);
}

function pulsePressState(): void {
  document.documentElement.setAttribute("data-chh-lg-pressed", "true");
  window.setTimeout(() => document.documentElement.removeAttribute("data-chh-lg-pressed"), 180);
}

function bindGlobalState(): void {
  document.documentElement.style.setProperty("--chh-lg-pointer-x", lastPointer.x);
  document.documentElement.style.setProperty("--chh-lg-pointer-y", lastPointer.y);
  document.documentElement.style.setProperty("--chh-pointer-x", lastPointer.x);
  document.documentElement.style.setProperty("--chh-pointer-y", lastPointer.y);

  if (globalStateBound) {
    syncScrollState();
    return;
  }

  window.addEventListener("scroll", syncScrollState, { passive: true });
  window.addEventListener("pointermove", schedulePointerState, { passive: true });
  window.addEventListener("pointerdown", pulsePressState, { passive: true });
  globalStateBound = true;
  syncScrollState();
}

function getNavPill(): HTMLElement | null {
  const ul = document.querySelector<HTMLElement>(`#${HEADER_ID} #nv > ul`);
  if (!ul) return null;

  const existing = ul.querySelector<HTMLElement>(".chh-lg-nav-pill");
  if (existing) return existing;

  const pill = makeNode("div", "chh-lg-nav-pill");
  ul.prepend(pill);
  return pill;
}

function bindNavHoverPill(): void {
  const ul = document.querySelector<HTMLElement>(`#${HEADER_ID} #nv > ul`);
  if (!ul || ul.getAttribute(NAV_PILL_BOUND_ATTR) === "true") return;

  const pill = getNavPill();
  if (!pill) return;

  let isVisible = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function showPillAt(li: HTMLLIElement): void {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    const anchor = li.querySelector<HTMLAnchorElement>("a");
    const target = anchor ?? li;
    const ulRect = ul!.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    if (!isVisible) {
      // 首次进入：先无动画定位，再 fade in
      pill.style.transition = "opacity 140ms ease";
      pill.style.left = (targetRect.left - ulRect.left) + "px";
      pill.style.width = targetRect.width + "px";
    } else {
      // 已显示：恢复完整过渡，平滑滑动
      pill.style.transition = "";
      pill.style.left = (targetRect.left - ulRect.left) + "px";
      pill.style.width = targetRect.width + "px";
    }

    pill.setAttribute("data-chh-lg-pill-visible", "true");
    isVisible = true;

    ul!.querySelectorAll<HTMLLIElement>("li").forEach((l) => l.removeAttribute(NAV_HOVER_ATTR));
    li.setAttribute(NAV_HOVER_ATTR, "true");
  }

  function schedulePillHide(): void {
    hideTimer = setTimeout(() => {
      pill.removeAttribute("data-chh-lg-pill-visible");
      isVisible = false;
      ul!.querySelectorAll<HTMLLIElement>("li").forEach((l) => l.removeAttribute(NAV_HOVER_ATTR));
    }, 80);
  }

  ul.querySelectorAll<HTMLLIElement>("li").forEach((li) => {
    li.addEventListener("pointerenter", () => showPillAt(li), { passive: true });
  });

  ul.addEventListener("pointerleave", schedulePillHide, { passive: true });

  ul.setAttribute(NAV_PILL_BOUND_ATTR, "true");
}

export const enhanceLiquidGlassHeader: ContentAdapter = ({ settings }) => {
  if (settings.themeId !== "liquid-glass") return;

  syncLiquidGlassClass();
  bindGlobalState();
  buildHeaderShell();
  cleanupCommunityLabel();
  syncNavActiveState();
  relocateHeaderMenus();
  bindQuickMenuPlacement();
  bindNavHoverPill();
  markPromoArea();
  enhanceForumDirectory();
  enhanceFooterRail();
};
