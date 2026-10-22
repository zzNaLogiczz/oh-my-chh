// 批注窗格：每楼一张“Excel 批注”卡片（头像 / 作者 / 时间 / 正文块），图片按可见性显示缩略图或文件名
// 可回帖时：选中的卡片底部出现“答复…”（答复这一楼），窗格底部是回复楼主的输入框
import type { Post, PostBlock } from "../model";
import { createComposer, type ComposerHandle, type ReplyResult } from "./composer";
import type { ImageVisibility } from "./image-visibility";
import { openLightbox } from "./lightbox";
import { scrollToReveal } from "./scroll";

type ImageBlock = Extract<PostBlock, { kind: "image" }>;
/** 单击要等这么久确认不是双击，避免双击时缩略图先放大又缩回 */
const CLICK_DELAY_MS = 260;

export type { ReplyResult } from "./composer";

export interface ReplyHandlers {
  /** 回复楼主的草稿 key；楼层答复框用 `${draftKey}:${pid}` */
  draftKey: string;
  drafts: Map<string, string>;
  /** floor 为 null 表示回复楼主 */
  submit(floor: Post | null, message: string): Promise<ReplyResult>;
}

export interface CommentsHandle {
  appendPosts(posts: Post[]): void;
  focusPost(pid: string): void;
  refreshImages(): void;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function avatar(post: Post): HTMLElement {
  const fallback = el("span", "xl-avatar xl-avatar-fallback", post.author.slice(0, 1));
  if (!post.avatar) return fallback;
  const img = el("img", "xl-avatar");
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.src = post.avatar;
  // 头像加载失败退回作者首字圆标
  img.addEventListener("error", () => img.replaceWith(fallback), { once: true });
  return img;
}

function paragraphs(text: string, className?: string): HTMLElement[] {
  return text.split(/\n+/).filter(Boolean).map((line) => el("p", className, line));
}

/** 缩略图：单击在窗格内放大，双击在整个窗口正中看大图 */
function imageNode(block: ImageBlock, visible: boolean, onOpen: (block: ImageBlock) => void): HTMLElement {
  if (!visible) return el("span", "xl-chip", `🖼 ${block.name}`);
  const img = el("img", "xl-thumb");
  img.alt = block.name;
  img.title = "单击放大 · 双击看大图";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = block.src;
  let timer = 0;
  img.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.detail > 1) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => img.classList.toggle("is-full"), CLICK_DELAY_MS);
  });
  img.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    window.clearTimeout(timer);
    onOpen(block);
  });
  return img;
}

function renderBody(body: HTMLElement, post: Post, visible: boolean, onOpen: (block: ImageBlock) => void): void {
  body.textContent = "";
  if (post.locked) { body.append(el("p", "xl-muted", "（内容已屏蔽）")); return; }
  for (const block of post.blocks) {
    if (block.kind === "text") body.append(...paragraphs(block.text));
    else if (block.kind === "image") body.append(imageNode(block, visible, onOpen));
    else {
      const quote = el("div", "xl-quote");
      if (block.author) quote.append(el("div", "xl-quote-head", `${block.author} 写道：`));
      quote.append(...paragraphs(block.text));
      body.append(quote);
    }
  }
}

export function renderCommentsPane(
  host: HTMLElement, posts: Post[], vis: ImageVisibility, handlers: { onCardSelect(pid: string): void; reply?: ReplyHandlers }
): CommentsHandle {
  host.classList.add("xl-comments");
  host.textContent = "";
  const head = el("div", "xl-comments-head");
  head.append(el("span", undefined, "批注"), el("span", "xl-muted", "✕"));
  const list = el("div", "xl-comments-list");
  host.append(head, list);
  const cards = new Map<string, { post: Post; body: HTMLElement; card: HTMLElement }>();
  const reply = handlers.reply;
  let footer: ComposerHandle | null = null;
  /** 发布结果统一显示在底部框的提示行：楼层答复框发完就关了 */
  const showResult = (result: ReplyResult) =>
    footer?.setNote(result.message, undefined, result.view ? { label: "查看", run: result.view } : undefined);

  const closeMenus = () => list.querySelectorAll(".xl-card-menu").forEach((menu) => menu.remove());

  /** 大图翻页范围：按楼层顺序收集当前显示着缩略图的楼层里的全部图片（用户隐藏的楼层不算） */
  const openImage = (block: ImageBlock) => {
    const shown = [...cards.values()]
      .filter(({ post }) => !post.locked && vis.isVisible(post.pid))
      .flatMap(({ post }) => post.blocks.filter((b): b is ImageBlock => b.kind === "image"));
    openLightbox(shown, Math.max(0, shown.indexOf(block)));
  };
  const render = (body: HTMLElement, post: Post) => renderBody(body, post, vis.isVisible(post.pid), openImage);

  /** 在卡片里打开（或聚焦已打开的）答复框；关闭时草稿留在 drafts 里，再打开会带回来 */
  function openFloorReply(post: Post, card: HTMLElement, stub: HTMLElement): void {
    if (!reply) return;
    const open = card.querySelector<HTMLTextAreaElement>(".xl-compose textarea");
    if (open) { open.focus(); return; }
    const close = () => { composer.element.remove(); card.classList.remove("is-replying"); };
    const composer = createComposer({
      placeholder: `答复 ${post.author}…`,
      draftKey: `${reply.draftKey}:${post.pid}`,
      drafts: reply.drafts,
      submit: (message) => reply.submit(post, message),
      onSent: (result) => { close(); showResult(result); },
      onCancel: close
    });
    card.classList.add("is-replying");
    stub.before(composer.element);
    composer.focus();
  }

  function buildCard(post: Post): HTMLElement {
    const card = el("div", "xl-card");
    card.dataset.pid = post.pid;
    const cardHead = el("div", "xl-card-head");
    const more = el("button", "xl-card-more", "···");
    cardHead.append(avatar(post), el("span", "xl-card-author", post.author), el("span", "xl-card-time", post.postedAt ?? ""), more);
    const body = el("div", "xl-card-body");
    render(body, post);
    card.append(cardHead, body);
    cards.set(post.pid, { post, body, card });
    const canReply = Boolean(reply && post.replyMode);
    const stub = el("button", "xl-reply-stub", "答复…");
    if (canReply) {
      stub.type = "button";
      stub.addEventListener("click", (event) => { event.stopPropagation(); openFloorReply(post, card, stub); });
      card.append(stub);
    }

    // ··· 菜单：单条切换图片显示，不影响其他楼层
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      closeMenus();
      const menu = el("div", "xl-card-menu");
      const toggle = el("button", undefined, vis.isVisible(post.pid) ? "隐藏图片" : "显示图片");
      toggle.addEventListener("click", (inner) => {
        inner.stopPropagation();
        vis.toggle(post.pid);
        render(body, post);
        menu.remove();
      });
      menu.append(toggle);
      if (canReply) {
        const answer = el("button", undefined, "答复");
        answer.addEventListener("click", (inner) => {
          inner.stopPropagation();
          menu.remove();
          openFloorReply(post, card, stub);
        });
        menu.append(answer);
      }
      card.append(menu);
    });
    card.addEventListener("click", () => { closeMenus(); handlers.onCardSelect(post.pid); });
    return card;
  }

  if (reply) {
    const foot = el("div", "xl-comments-foot");
    footer = createComposer({
      placeholder: "回复楼主…",
      draftKey: reply.draftKey,
      drafts: reply.drafts,
      submit: (message) => reply.submit(null, message),
      onSent: showResult
    });
    foot.append(footer.element);
    host.append(foot);
  }

  const append = (next: Post[]) => {
    const fragment = document.createDocumentFragment();
    for (const post of next) fragment.append(buildCard(post));
    list.append(fragment);
  };
  append(posts);

  return {
    appendPosts: append,
    focusPost(pid) {
      list.querySelector(".xl-card.is-current")?.classList.remove("is-current");
      const entry = cards.get(pid);
      if (!entry) return;
      entry.card.classList.add("is-current");
      // 只滚动批注列表本身（列表是定位容器，offsetTop 相对列表）
      list.scrollTop = scrollToReveal(entry.card.offsetTop, entry.card.offsetHeight, list.scrollTop, list.clientHeight, 0);
    },
    refreshImages() {
      for (const { post, body } of cards.values()) render(body, post);
    },
    destroy() {
      host.textContent = "";
      cards.clear();
    }
  };
}
