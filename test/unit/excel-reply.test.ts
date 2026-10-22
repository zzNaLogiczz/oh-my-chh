import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExcelApp, type ExcelAppHandle } from "../../src/remake/excel/app/app";
import { renderCommentsPane, type ReplyResult } from "../../src/remake/excel/app/comments";
import { createImageVisibility } from "../../src/remake/excel/app/image-visibility";
import { createHostController } from "../../src/remake/excel/host/controller";
import { parseReplyResponse, submitReply } from "../../src/remake/excel/host/reply";
import type { Post, ThreadDetailPage } from "../../src/remake/excel/model";
import { findPostUrl } from "../../src/remake/excel/parse/common";
import { parseThreadDetail } from "../../src/remake/excel/parse/thread-detail";
import { DEFAULT_EXCEL_PREFS } from "../../src/remake/excel/prefs";
import type { AppToHost, HostToApp, ReplyOutcome, ReplyRequest } from "../../src/remake/excel/protocol";
import { FIXTURE_BASE as BASE, loadExcelFixture } from "./helpers/excel-fixtures";

const THREAD_URL = "https://www.chiphell.com/forum.php?mod=viewthread&tid=2192109";

/** 脱敏夹具去掉了 formhash，这里补一个假的，模拟已登录可回帖的页面 */
function replyableDoc(formhash = "a1b2c3d4"): Document {
  const doc = loadExcelFixture("thread-detail");
  const input = doc.createElement("input");
  input.type = "hidden";
  input.name = "formhash";
  input.setAttribute("value", formhash);
  doc.querySelector("#fastpostform")!.append(input);
  return doc;
}
const replyablePage = () => parseThreadDetail(replyableDoc(), THREAD_URL);

const xml = (inner: string) => `<?xml version="1.0" encoding="utf-8"?>\r\n<root><![CDATA[${inner}]]></root>`;
const SUCCESS = xml("非常感谢，回复发布成功，现在将转入主题页，请稍候……<script type=\"text/javascript\" reload=\"1\">if(typeof succeedhandle_fastpost=='function') {succeedhandle_fastpost('forum.php?mod=viewthread&tid=2192109&pid=55501234&page=8&extra=#pid55501234', '非常感谢，回复发布成功，现在将转入主题页，请稍候……', {'fid':'22','tid':'2192109','pid':'55501234','from':'','sechash':''});}</script>");
// 真实回执（2026-10-22 用空内容提交取得，服务器直接拒绝，没有发出任何内容）
const EMPTY_REJECTED = xml("抱歉，您尚未输入标题或内容<script type=\"text/javascript\" reload=\"1\">if(typeof errorhandle_fastpost=='function') {errorhandle_fastpost('抱歉，您尚未输入标题或内容', {});}</script>");
const FLOOR_FORM = xml([
  '<h3 class="flb"><em id="return_reply">参与/回复主题</em></h3>',
  '<form method="post" autocomplete="off" id="postform" action="forum.php?mod=post&amp;infloat=yes&amp;action=reply&amp;fid=22&amp;extra=&amp;tid=2192109&amp;replysubmit=yes">',
  '<input type="hidden" name="formhash" value="a1b2c3d4" /><input type="hidden" name="handlekey" value="reply" />',
  '<input type="hidden" name="noticeauthor" value="enc0ded" /><input type="hidden" name="noticetrimstr" value="[quote]B站视频嵌入测试[/quote]" />',
  '<input type="hidden" name="noticeauthormsg" value="B站视频嵌入测试" /><input type="hidden" name="usesig" value="0" />',
  '<input type="hidden" name="reppid" value="44409518" /><input type="hidden" name="reppost" value="44409518" />',
  '<input name="subject" value="" /><textarea name="message"></textarea></form>'
].join(""));

const respond = (body: string) => ({ ok: true, status: 200, url: "", text: async () => body });
const threadRequest = (patch: Partial<ReplyRequest> = {}): ReplyRequest =>
  ({ tid: "2192109", fid: "22", formhash: "a1b2c3d4", message: "楼主辛苦了，支持一下", floor: null, ...patch });

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("reply credentials on the thread page", () => {
  it("reads the quick-reply form", () => {
    expect(replyablePage().reply).toEqual({ fid: "22", formhash: "a1b2c3d4" });
  });

  it("has none when the page offers no quick reply (logged out or thread closed)", () => {
    const doc = replyableDoc();
    doc.querySelector("#fastpostform")!.remove();
    expect(parseThreadDetail(doc, THREAD_URL).reply).toBeNull();
    expect(parseThreadDetail(loadExcelFixture("thread-detail"), THREAD_URL).reply).toBeNull();
  });

  it("knows how each floor is replied to: the opening post is notified, later floors are quoted", () => {
    const page = replyablePage();
    expect(page.posts[0].replyMode).toBe("reppost");
    expect(page.posts[1].replyMode).toBe("repquote");
  });

  it("takes the thread id from the reply form when the address carries none", () => {
    const doc = loadExcelFixture("thread-detail-p2");
    expect(parseThreadDetail(doc, BASE).tid).toBe("2192109");
  });
});

describe("reply receipts", () => {
  it("reports a rejection in the server's own words", () => {
    expect(parseReplyResponse(EMPTY_REJECTED)).toEqual({ ok: false, message: "抱歉，您尚未输入标题或内容", pid: null });
  });

  it("reads a success and the new post id", () => {
    expect(parseReplyResponse(SUCCESS)).toEqual({ ok: true, message: "非常感谢，回复发布成功，现在将转入主题页，请稍候……", pid: "55501234" });
  });

  it("unescapes quotes inside the message", () => {
    const body = xml("<script>if(typeof errorhandle_reply=='function') {errorhandle_reply('请勿使用\\'特殊\\'字符', {});}</script>");
    expect(parseReplyResponse(body).message).toBe("请勿使用'特殊'字符");
  });

  it("treats a success notice without a receipt script as posted, so nobody posts twice", () => {
    const page = '<div id="messagetext" class="alert_right"><p>非常感谢，回复发布成功</p><a href="forum.php?mod=viewthread&amp;tid=2192109&amp;pid=55501234#pid55501234">如果您的浏览器没有自动跳转</a></div>';
    expect(parseReplyResponse(xml(page))).toEqual({ ok: true, message: "非常感谢，回复发布成功", pid: "55501234" });
  });

  it("falls back to the page notice when there is no receipt script", () => {
    const page = '<!DOCTYPE html><html><body><div id="messagetext"><p>您需要先登录才能继续本操作</p></div></body></html>';
    expect(parseReplyResponse(page)).toEqual({ ok: false, message: "您需要先登录才能继续本操作", pid: null });
  });
});

describe("submitting replies", () => {
  it("replies to the thread through the quick-reply form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(SUCCESS));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await submitReply(threadRequest());
    expect(outcome).toMatchObject({ ok: true, pid: "55501234" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const target = new URL(url);
    expect(target.origin).toBe("https://www.chiphell.com");
    expect(Object.fromEntries(target.searchParams)).toMatchObject({
      mod: "post", action: "reply", fid: "22", tid: "2192109", replysubmit: "yes", handlekey: "fastpost", inajax: "1"
    });
    expect(init).toMatchObject({ method: "POST", credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ message: "楼主辛苦了，支持一下", formhash: "a1b2c3d4", usesig: "", subject: " " });
  });

  it("answers a floor by submitting the server's own reply form for it", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respond(FLOOR_FORM)).mockResolvedValueOnce(respond(SUCCESS));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await submitReply(threadRequest({ message: "同意楼上的看法", floor: { pid: "44409518", mode: "repquote" } }));
    expect(outcome.ok).toBe(true);
    const [formUrl, formInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(Object.fromEntries(new URL(formUrl).searchParams)).toMatchObject({
      mod: "post", action: "reply", fid: "22", tid: "2192109", repquote: "44409518", infloat: "yes", handlekey: "reply", inajax: "1"
    });
    // Discuz 开了 ajax 校验：GET 不带这个头会返回整页而不是表单片段
    expect(formInit).toMatchObject({ credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
    expect(formInit.method ?? "GET").toBe("GET");
    const [postUrl, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(Object.fromEntries(new URL(postUrl).searchParams)).toMatchObject({
      mod: "post", action: "reply", fid: "22", tid: "2192109", replysubmit: "yes", infloat: "yes", inajax: "1"
    });
    expect(postInit.method).toBe("POST");
    expect(Object.fromEntries(postInit.body as URLSearchParams)).toEqual({
      formhash: "a1b2c3d4", handlekey: "reply", noticeauthor: "enc0ded", noticetrimstr: "[quote]B站视频嵌入测试[/quote]",
      noticeauthormsg: "B站视频嵌入测试", usesig: "0", reppid: "44409518", reppost: "44409518", subject: "", message: "同意楼上的看法"
    });
  });

  it("asks the opening post's form with reppost so the author is notified without a quote", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respond(FLOOR_FORM)).mockResolvedValueOnce(respond(SUCCESS));
    vi.stubGlobal("fetch", fetchMock);
    await submitReply(threadRequest({ floor: { pid: "44409514", mode: "reppost" } }));
    const params = new URL(fetchMock.mock.calls[0][0] as string).searchParams;
    expect(params.get("reppost")).toBe("44409514");
    expect(params.has("repquote")).toBe(false);
  });

  it("explains why a floor cannot be answered without posting anything", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(xml("<script>if(typeof errorhandle_reply=='function') {errorhandle_reply('抱歉，本主题已关闭，不再接受新内容', {});}</script>")));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await submitReply(threadRequest({ floor: { pid: "44409518", mode: "repquote" } }));
    expect(outcome).toEqual({ ok: false, message: "抱歉，本主题已关闭，不再接受新内容", pid: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses malformed ids before touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitReply(threadRequest({ tid: "1&fid=2" }))).rejects.toThrow();
    await expect(submitReply(threadRequest({ floor: { pid: "x", mode: "repquote" } }))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("host controller replies", () => {
  function setup(submit: (request: ReplyRequest) => Promise<ReplyOutcome>) {
    const channel = new MessageChannel();
    const sent: HostToApp[] = [];
    channel.port1.onmessage = (event) => sent.push(event.data as HostToApp);
    createHostController({
      port: channel.port2,
      fetchPage: vi.fn(),
      initialPage: vi.fn(),
      submitReply: submit,
      pushState: vi.fn(),
      canGoBack: () => false,
      goBack: vi.fn(),
      currentUrl: () => THREAD_URL,
      openOriginal: vi.fn()
    });
    return { sent, app: (message: AppToHost) => channel.port1.postMessage(message), close: () => { channel.port1.close(); channel.port2.close(); } };
  }

  it("submits the reply and answers with the outcome", async () => {
    const submit = vi.fn(async (): Promise<ReplyOutcome> => ({ ok: true, message: "ok", pid: "55501234" }));
    const t = setup(submit);
    t.app({ type: "reply", replyId: 7, request: threadRequest() });
    await vi.waitFor(() => expect(t.sent).toContainEqual({ type: "reply-result", replyId: 7, outcome: { ok: true, message: "ok", pid: "55501234" } }));
    expect(submit).toHaveBeenCalledWith(threadRequest());
    t.close();
  });

  it("turns network failures into a plain failed outcome", async () => {
    const t = setup(async () => { throw new TypeError("Failed to fetch"); });
    t.app({ type: "reply", replyId: 8, request: threadRequest() });
    await vi.waitFor(() => expect(t.sent).toContainEqual({
      type: "reply-result", replyId: 8, outcome: { ok: false, message: "无法连接到数据源，请检查网络后重试。", pid: null }
    }));
    t.close();
  });
});

describe("reply boxes in the comments pane", () => {
  function mount(submit: (floor: Post | null, message: string) => Promise<ReplyResult>, drafts = new Map<string, string>()) {
    const page = replyablePage();
    const host = document.createElement("div");
    document.body.append(host);
    const pane = renderCommentsPane(host, page.posts, createImageVisibility("show"), { onCardSelect: vi.fn(), reply: { draftKey: "t2192109", drafts, submit } });
    const card = (pid: string) => host.querySelector<HTMLElement>(`.xl-card[data-pid="${pid}"]`)!;
    const footer = () => host.querySelector<HTMLElement>(".xl-comments-foot")!;
    return { page, host, pane, card, footer, drafts };
  }
  const type = (box: HTMLTextAreaElement, value: string) => {
    box.value = value;
    box.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const ctrlEnter = (box: HTMLElement) => box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));

  it("puts a reply-to-thread box at the bottom, disabled until there is text", () => {
    const { footer } = mount(vi.fn());
    const box = footer().querySelector<HTMLTextAreaElement>(".xl-compose textarea")!;
    expect(box.placeholder).toBe("回复楼主…");
    const send = footer().querySelector<HTMLButtonElement>(".xl-compose-send")!;
    expect(send.disabled).toBe(true);
    type(box, "   ");
    expect(send.disabled).toBe(true);
    type(box, "支持");
    expect(send.disabled).toBe(false);
  });

  it("posts the bottom box with Ctrl+Enter and clears it on success", async () => {
    const submit = vi.fn(async (): Promise<ReplyResult> => ({ ok: true, message: "已发布" }));
    const { footer, drafts } = mount(submit);
    const box = footer().querySelector<HTMLTextAreaElement>("textarea")!;
    type(box, "楼主辛苦了，支持一下");
    expect(drafts.get("t2192109")).toBe("楼主辛苦了，支持一下");
    ctrlEnter(box);
    expect(submit).toHaveBeenCalledWith(null, "楼主辛苦了，支持一下");
    await vi.waitFor(() => expect(box.value).toBe(""));
    expect(footer().querySelector(".xl-compose-note")?.textContent).toBe("已发布");
    expect(drafts.has("t2192109")).toBe(false);
  });

  it("keeps the text and shows the server's reason when posting fails", async () => {
    const { footer } = mount(async () => ({ ok: false, message: "抱歉，您的帖子小于 8 个字符的限制" }));
    const box = footer().querySelector<HTMLTextAreaElement>("textarea")!;
    type(box, "顶");
    footer().querySelector<HTMLButtonElement>(".xl-compose-send")!.click();
    const note = footer().querySelector<HTMLElement>(".xl-compose-note")!;
    await vi.waitFor(() => expect(note.textContent).toBe("抱歉，您的帖子小于 8 个字符的限制"));
    expect(note.classList.contains("is-error")).toBe(true);
    expect(box.value).toBe("顶");
    expect(box.readOnly).toBe(false);
  });

  it("locks the box while sending so a reply is not posted twice", async () => {
    let finish!: (result: ReplyResult) => void;
    const submit = vi.fn(() => new Promise<ReplyResult>((resolve) => { finish = resolve; }));
    const { footer } = mount(submit);
    const box = footer().querySelector<HTMLTextAreaElement>("textarea")!;
    type(box, "楼主辛苦了，支持一下");
    ctrlEnter(box);
    ctrlEnter(box);
    footer().querySelector<HTMLButtonElement>(".xl-compose-send")!.click();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(box.readOnly).toBe(true);
    expect(footer().querySelector(".xl-compose-note")?.textContent).toBe("正在发布…");
    finish({ ok: true, message: "已发布" });
    await vi.waitFor(() => expect(box.readOnly).toBe(false));
  });

  it("opens a reply box inside a floor's card and answers that floor", async () => {
    const submit = vi.fn(async (): Promise<ReplyResult> => ({ ok: true, message: "已发布" }));
    const { page, card, footer } = mount(submit);
    const floor = page.posts[1];
    card(floor.pid).querySelector<HTMLButtonElement>(".xl-reply-stub")!.click();
    const box = card(floor.pid).querySelector<HTMLTextAreaElement>(".xl-compose textarea")!;
    expect(box.placeholder).toBe(`答复 ${floor.author}…`);
    expect(document.activeElement).toBe(box);
    type(box, "同意楼上的看法");
    ctrlEnter(box);
    expect(submit).toHaveBeenCalledWith(floor, "同意楼上的看法");
    await vi.waitFor(() => expect(card(floor.pid).querySelector(".xl-compose")).toBeNull());
    expect(footer().querySelector(".xl-compose-note")?.textContent).toBe("已发布");
  });

  it("also offers 答复 in a card's ··· menu", () => {
    const { page, card } = mount(vi.fn());
    const floor = page.posts[2];
    card(floor.pid).querySelector<HTMLElement>(".xl-card-more")!.click();
    const item = [...card(floor.pid).querySelectorAll<HTMLButtonElement>(".xl-card-menu button")].find((b) => b.textContent === "答复")!;
    item.click();
    expect(card(floor.pid).querySelector(".xl-compose textarea")).not.toBeNull();
    expect(card(floor.pid).querySelector(".xl-card-menu")).toBeNull();
  });

  it("closes a floor box on Esc and brings the draft back when reopened", () => {
    const { page, card } = mount(vi.fn());
    const floor = page.posts[1];
    const stub = () => card(floor.pid).querySelector<HTMLButtonElement>(".xl-reply-stub")!;
    stub().click();
    const box = card(floor.pid).querySelector<HTMLTextAreaElement>(".xl-compose textarea")!;
    type(box, "写到一半");
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(card(floor.pid).querySelector(".xl-compose")).toBeNull();
    stub().click();
    expect(card(floor.pid).querySelector<HTMLTextAreaElement>(".xl-compose textarea")!.value).toBe("写到一半");
  });

  it("restores the bottom draft when the pane is rebuilt", () => {
    const drafts = new Map([["t2192109", "还没写完"]]);
    const { footer } = mount(vi.fn(), drafts);
    expect(footer().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("还没写完");
  });

  it("shows no reply controls when the thread cannot be replied to", () => {
    const host = document.createElement("div");
    renderCommentsPane(host, replyablePage().posts, createImageVisibility("show"), { onCardSelect: vi.fn() });
    expect(host.querySelector(".xl-compose")).toBeNull();
    expect(host.querySelector(".xl-reply-stub")).toBeNull();
  });
});

describe("replying from the Excel app", () => {
  let channel: MessageChannel;
  let received: AppToHost[];
  let app: ExcelAppHandle;
  let root: HTMLElement;

  beforeEach(() => {
    sessionStorage.setItem("omchh-excel-forum", "1");
    channel = new MessageChannel();
    received = [];
    channel.port1.onmessage = (event) => received.push(event.data as AppToHost);
    root = document.createElement("div");
    document.body.append(root);
    app = createExcelApp(root, { port: channel.port2, prefs: DEFAULT_EXCEL_PREFS, workbook: null, openOptions: vi.fn() });
  });
  afterEach(() => {
    app.destroy();
    channel.port1.close();
    channel.port2.close();
    sessionStorage.clear();
  });

  const send = (message: HostToApp) => channel.port1.postMessage(message);
  const lastPage = (page: ThreadDetailPage): ThreadDetailPage =>
    ({ ...page, pageInfo: { ...page.pageInfo, page: 7, totalPages: 7, nextUrl: null } });
  const newPost = (page: ThreadDetailPage): Post =>
    ({ ...page.posts[page.posts.length - 1], pid: "55501234", floor: 213, author: "我", blocks: [{ kind: "text", text: "楼主辛苦了，支持一下" }] });

  async function openThread(page: ThreadDetailPage) {
    send({ type: "page", requestId: 1, url: THREAD_URL, page, append: false, canBack: false });
    await vi.waitFor(() => expect(root.querySelector(".xl-comments-foot textarea")).not.toBeNull());
  }
  async function replyFromBottom(text: string) {
    const box = root.querySelector<HTMLTextAreaElement>(".xl-comments-foot textarea")!;
    box.value = text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>(".xl-comments-foot .xl-compose-send")!.click();
    await vi.waitFor(() => expect(received.some((m) => m.type === "reply")).toBe(true));
    return received.find((m): m is Extract<AppToHost, { type: "reply" }> => m.type === "reply")!;
  }

  it("sends the reply with the page's credentials", async () => {
    await openThread(replyablePage());
    const message = await replyFromBottom("楼主辛苦了，支持一下");
    expect(message.request).toEqual({ tid: "2192109", fid: "22", formhash: "a1b2c3d4", message: "楼主辛苦了，支持一下", floor: null });
  });

  it("sends the floor and how it is answered when replying inside a card", async () => {
    const page = replyablePage();
    await openThread(page);
    const floor = page.posts[1];
    root.querySelector<HTMLButtonElement>(`.xl-card[data-pid="${floor.pid}"] .xl-reply-stub`)!.click();
    const box = root.querySelector<HTMLTextAreaElement>(`.xl-card[data-pid="${floor.pid}"] textarea`)!;
    box.value = "同意楼上的看法";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    ctrlEnterIn(box);
    await vi.waitFor(() => expect(received.find((m) => m.type === "reply")).toMatchObject({
      request: { message: "同意楼上的看法", floor: { pid: floor.pid, mode: "repquote" } }
    }));
  });
  const ctrlEnterIn = (box: HTMLElement) => box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));

  it("shows the new floor in place when the thread's last page is already loaded", async () => {
    const page = lastPage(replyablePage());
    await openThread(page);
    const floorRows = () => root.querySelectorAll(".xl-forum td.xl-has-comment").length;
    const rowsBefore = floorRows();
    const reply = await replyFromBottom("楼主辛苦了，支持一下");
    send({ type: "reply-result", replyId: reply.replyId, outcome: { ok: true, message: "非常感谢，回复发布成功，现在将转入主题页，请稍候……", pid: "55501234" } });
    await vi.waitFor(() => expect(received).toContainEqual({ type: "navigate", url: findPostUrl("2192109", "55501234"), append: true }));
    // 回帖所在页包含已显示的楼层：只追加新楼层，不重复
    send({ type: "page", requestId: 2, url: THREAD_URL, page: { ...page, posts: [...page.posts.slice(-3), newPost(page)] }, append: true, canBack: false });
    await vi.waitFor(() => expect(root.querySelector('.xl-card[data-pid="55501234"]')).not.toBeNull());
    expect(floorRows()).toBe(rowsBefore + 1);
    expect(root.querySelectorAll(".xl-card")).toHaveLength(page.posts.length + 1);
    expect(root.querySelector(".xl-card.is-current")?.getAttribute("data-pid")).toBe("55501234");
    expect(root.querySelector(".xl-comments-foot .xl-compose-note")?.textContent).toBe("已发布");
  });

  it("stays on the current page and offers 查看 when the new floor lands on a later page", async () => {
    const page = replyablePage();
    await openThread(page);
    const reply = await replyFromBottom("楼主辛苦了，支持一下");
    send({ type: "reply-result", replyId: reply.replyId, outcome: { ok: true, message: "非常感谢，回复发布成功", pid: "55501234" } });
    const view = await vi.waitFor(() => {
      const link = root.querySelector<HTMLButtonElement>(".xl-comments-foot .xl-compose-note button");
      expect(link?.textContent).toBe("查看");
      return link!;
    });
    expect(received.some((m) => m.type === "navigate")).toBe(false);
    view.click();
    await vi.waitFor(() => expect(received).toContainEqual({ type: "navigate", url: findPostUrl("2192109", "55501234"), append: false }));
    send({ type: "page", requestId: 3, url: THREAD_URL, page: { ...lastPage(page), posts: [...page.posts.slice(-2), newPost(page)] }, append: false, canBack: true });
    await vi.waitFor(() => expect(root.querySelector(".xl-card.is-current")?.getAttribute("data-pid")).toBe("55501234"));
  });

  it("passes on what the server says when a reply is held for moderation", async () => {
    const page = lastPage(replyablePage());
    await openThread(page);
    const reply = await replyFromBottom("楼主辛苦了，支持一下");
    send({ type: "reply-result", replyId: reply.replyId, outcome: { ok: true, message: "新回复需要审核，您的帖子通过审核后才能显示", pid: null } });
    await vi.waitFor(() => expect(root.querySelector(".xl-comments-foot .xl-compose-note")?.textContent).toBe("新回复需要审核，您的帖子通过审核后才能显示"));
    expect(received.some((m) => m.type === "navigate")).toBe(false);
  });

  it("links grid rows and cards for floors appended while scrolling", async () => {
    const page = replyablePage();
    await openThread(page);
    const more = parseThreadDetail(loadExcelFixture("thread-detail-p2"), THREAD_URL);
    send({ type: "page", requestId: 4, url: THREAD_URL, page: more, append: true, canBack: false });
    const target = more.posts[3];
    const card = await vi.waitFor(() => {
      const found = root.querySelector<HTMLElement>(`.xl-card[data-pid="${target.pid}"]`);
      expect(found).not.toBeNull();
      return found!;
    });
    card.click();
    // 前两行是标题行和表头
    const row = 2 + page.posts.length + 3;
    expect(root.querySelector(".xl-forum td.xl-sel")?.getAttribute("data-r")).toBe(String(row));
  });
});
