// 看大图：双击批注里的缩略图，在整个窗口正中铺开显示；左右键 / 按钮翻看本帖可见图片，Esc 或点空白处关闭

export interface LightboxImage { src: string; name: string }

let current: { close(): void } | null = null;

/** 关掉正在显示的大图（老板键、隐藏图片、翻到别的页面时调用） */
export function closeLightbox(): void {
  current?.close();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(className: string, text: string, label: string): HTMLButtonElement {
  const button = el("button", className, text);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  return button;
}

export function openLightbox(images: LightboxImage[], start: number): void {
  closeLightbox();
  if (!images.length) return;
  const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let index = Math.min(Math.max(start, 0), images.length - 1);

  const box = el("div", images.length > 1 ? "xl-lightbox" : "xl-lightbox is-single");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "图片预览");
  box.tabIndex = -1;
  const stage = el("div", "xl-lb-stage");
  const img = el("img", "xl-lb-img");
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  stage.append(img);
  const status = el("div", "xl-lb-status");
  const close = iconButton("xl-lb-close", "✕", "关闭（Esc）");
  const prev = iconButton("xl-lb-prev", "‹", "上一张（←）");
  const next = iconButton("xl-lb-next", "›", "下一张（→）");
  const bar = el("div", "xl-lb-bar");
  const name = el("span", "xl-lb-name");
  const count = el("span", "xl-lb-count");
  const zoom = el("button", "xl-lb-zoom", "原始大小");
  zoom.type = "button";
  bar.append(name, count, zoom);
  box.append(stage, status, close, prev, next, bar);

  function setActual(actual: boolean): void {
    box.classList.toggle("is-actual", actual);
    zoom.textContent = actual ? "适应窗口" : "原始大小";
  }

  function show(target: number): void {
    // 首尾相接：第一张往前是最后一张
    index = (target + images.length) % images.length;
    const image = images[index];
    setActual(false);
    box.classList.remove("is-error");
    box.classList.add("is-loading");
    status.textContent = "加载中…";
    img.onload = () => { box.classList.remove("is-loading"); status.textContent = ""; };
    img.onerror = () => { box.classList.remove("is-loading"); box.classList.add("is-error"); status.textContent = "图片加载失败"; };
    img.alt = image.name;
    img.src = image.src;
    name.textContent = image.name;
    name.title = image.name;
    count.textContent = `${index + 1} / ${images.length}`;
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }

  function dispose(): void {
    box.remove();
    current = null;
    restoreFocus?.focus({ preventScroll: true });
  }

  // 点图片切换“适应窗口 / 原始大小”，点图片以外的空白处关闭
  img.addEventListener("click", () => setActual(!box.classList.contains("is-actual")));
  zoom.addEventListener("click", () => setActual(!box.classList.contains("is-actual")));
  box.addEventListener("click", (event) => { if (event.target === box || event.target === stage) dispose(); });
  close.addEventListener("click", dispose);
  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  box.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (event.key !== "Escape" && !step) return;
    // 方向键与 Esc 只给大图用，不再传给下面的网格
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") dispose();
    else if (images.length > 1) show(index + step);
  });

  document.body.append(box);
  current = { close: dispose };
  show(index);
  box.focus({ preventScroll: true });
}
