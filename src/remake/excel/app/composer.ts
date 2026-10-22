// 批注回复框（仿 Excel 线程批注的答复框）：Ctrl / ⌘ + Enter 发布，草稿按 key 存在调用方的 Map 里
export interface ReplyResult {
  ok: boolean;
  /** 成功时是给用户看的结果（“已发布”或服务器的审核提示），失败时是服务器给的原因 */
  message: string;
  /** 新回帖不在已加载的页里时，提供“查看”跳过去 */
  view?: () => void;
}

export interface ComposerOptions {
  placeholder: string;
  draftKey: string;
  drafts: Map<string, string>;
  submit(message: string): Promise<ReplyResult>;
  onSent(result: ReplyResult): void;
  /** 有值时显示 ✕，Esc 也会关闭（楼层内的答复框）；草稿保留 */
  onCancel?(): void;
}

export interface ComposerHandle {
  element: HTMLElement;
  focus(): void;
  setNote(text: string, tone?: "error", action?: { label: string; run(): void }): void;
}

const MAX_HEIGHT_PX = 160;
const SEND_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 2.2 14.6 8 1.5 13.8l1.6-5.1L9 8 3.1 7.3z" fill="currentColor"/></svg>';

function button(className: string, title: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.title = title;
  node.setAttribute("aria-label", title);
  return node;
}

export function createComposer(options: ComposerOptions): ComposerHandle {
  const element = document.createElement("div");
  element.className = options.onCancel ? "xl-compose is-inline" : "xl-compose";
  const input = document.createElement("textarea");
  input.rows = 1;
  input.placeholder = options.placeholder;
  input.value = options.drafts.get(options.draftKey) ?? "";
  const bar = document.createElement("div");
  bar.className = "xl-compose-bar";
  const note = document.createElement("span");
  note.className = "xl-compose-note";
  const send = button("xl-compose-send", "发布 (Ctrl+Enter)");
  send.innerHTML = SEND_ICON;
  bar.append(note);
  if (options.onCancel) {
    const cancel = button("xl-compose-cancel", "取消 (Esc)");
    cancel.textContent = "✕";
    cancel.addEventListener("click", () => options.onCancel?.());
    bar.append(cancel);
  }
  bar.append(send);
  element.append(input, bar);
  let busy = false;

  const setNote: ComposerHandle["setNote"] = (text, tone, action) => {
    note.textContent = text;
    note.classList.toggle("is-error", tone === "error");
    if (action) {
      const link = button("xl-compose-link", action.label);
      link.textContent = action.label;
      link.addEventListener("click", () => action.run());
      note.append(" · ", link);
    }
  };

  /** 随内容长高，超过上限后在框内滚动 */
  const fit = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_HEIGHT_PX)}px`;
  };
  const sync = () => {
    send.disabled = busy || !input.value.trim();
    element.classList.toggle("has-text", input.value.length > 0);
  };

  async function submit(): Promise<void> {
    const message = input.value.trim();
    if (busy || !message) return;
    // 发送期间锁住输入，防止重复按 Ctrl+Enter 发出两条
    busy = true;
    input.readOnly = true;
    element.classList.add("is-busy");
    setNote("正在发布…");
    sync();
    const result = await options.submit(message).catch((): ReplyResult => ({ ok: false, message: "发布失败，请稍后重试。" }));
    busy = false;
    input.readOnly = false;
    element.classList.remove("is-busy");
    if (result.ok) {
      input.value = "";
      options.drafts.delete(options.draftKey);
      setNote("");
      fit();
      options.onSent(result);
    } else {
      setNote(result.message, "error");
      input.focus();
    }
    sync();
  }

  input.addEventListener("input", () => {
    if (input.value) options.drafts.set(options.draftKey, input.value);
    else options.drafts.delete(options.draftKey);
    if (!busy) setNote("");
    fit();
    sync();
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); }
    else if (event.key === "Escape" && options.onCancel) { event.preventDefault(); options.onCancel(); }
  });
  send.addEventListener("click", () => { void submit(); });
  // 框内点击不冒泡到批注卡片，否则卡片的“选中楼层”会抢走焦点和滚动位置
  element.addEventListener("click", (event) => event.stopPropagation());
  sync();

  return { element, focus: () => input.focus(), setNote };
}
