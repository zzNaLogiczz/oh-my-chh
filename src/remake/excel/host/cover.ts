// 遮住原站：隐藏原 body、占位骨架、标签页标题与图标守卫（Excel 模式下原站一帧都不露）

/** 通用绿色表格图标（非微软官方 logo） */
export const EXCEL_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#217346"/>' +
      '<rect x="7" y="7" width="18" height="18" rx="1.5" fill="#fff"/><path d="M7 13h18M7 19h18M13 7v18M19 7v18" stroke="#217346" stroke-width="1.6"/></svg>'
  );

const COVER_CSS =
  "html{overflow:hidden!important;background:#fff!important}" +
  "html[data-omchh-excel] body{display:none!important}" +
  "#omchh-excel-skeleton{position:fixed;inset:0;z-index:2147483646;pointer-events:none;" +
  "background:linear-gradient(#217346 0 56px,#f3f3f3 56px 164px,transparent 164px)," +
  "repeating-linear-gradient(#0000 0 19px,#e1e1e1 19px 20px)," +
  "repeating-linear-gradient(90deg,#0000 0 63px,#e1e1e1 63px 64px),#fff}";

export function coverPage(doc: Document): void {
  const root = doc.documentElement;
  root.dataset.omchhExcel = "1";
  if (!doc.getElementById("omchh-excel-cover")) {
    const style = doc.createElement("style");
    style.id = "omchh-excel-cover";
    style.textContent = COVER_CSS;
    root.append(style);
  }
  // iframe 就绪前先画一个纯 CSS 的“空工作簿”骨架，避免白屏
  if (!doc.getElementById("omchh-excel-skeleton")) {
    const skeleton = doc.createElement("div");
    skeleton.id = "omchh-excel-skeleton";
    root.append(skeleton);
  }
}

export function removeSkeleton(doc: Document): void {
  doc.getElementById("omchh-excel-skeleton")?.remove();
}

/** 监听整个文档：页面后续写入或修改 <title> 时立即改回 */
export function guardTitle(doc: Document, title: string): () => void {
  const enforce = () => { if (doc.title !== title) doc.title = title; };
  enforce();
  const observer = new MutationObserver(enforce);
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true });
  return () => observer.disconnect();
}

const FAVICON_ID = "omchh-excel-favicon";

export function guardFavicon(doc: Document): () => void {
  const enforce = () => {
    // 移除站点自带的 icon / shortcut icon，保证只剩表格图标。
    // 按 id 认“自己人”：同一页面若有两个守卫（扩展重载后残留的旧实例），各自只认本实例的节点会互删成死循环
    for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) if (link.id !== FAVICON_ID) link.remove();
    if (doc.getElementById(FAVICON_ID)) return;
    const ours = doc.createElement("link");
    ours.rel = "icon";
    ours.type = "image/svg+xml";
    ours.href = EXCEL_FAVICON;
    ours.id = FAVICON_ID;
    (doc.head ?? doc.documentElement).append(ours);
  };
  enforce();
  const observer = new MutationObserver(enforce);
  observer.observe(doc.documentElement, { subtree: true, childList: true });
  return () => observer.disconnect();
}
