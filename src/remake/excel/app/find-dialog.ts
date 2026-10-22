// “查找和替换”风格的搜索框：提交后走 Discuz 原生站内搜索

export function searchUrl(keyword: string): string {
  return `https://www.chiphell.com/search.php?mod=forum&srchtxt=${encodeURIComponent(keyword)}&searchsubmit=yes`;
}

export function openFindDialog(host: HTMLElement, onSubmit: (keyword: string) => void): () => void {
  host.querySelector(".xl-dialog")?.remove();
  const dialog = document.createElement("div");
  dialog.className = "xl-dialog";
  dialog.setAttribute("role", "dialog");

  const title = document.createElement("div");
  title.className = "xl-dialog-title";
  const titleText = document.createElement("span");
  titleText.textContent = "查找和替换";
  const closeX = document.createElement("button");
  closeX.textContent = "✕";
  title.append(titleText, closeX);

  const body = document.createElement("div");
  body.className = "xl-dialog-body";
  const row = document.createElement("label");
  row.className = "xl-dialog-row";
  row.append(document.createTextNode("查找内容(N):"));
  const input = document.createElement("input");
  input.type = "text";
  row.append(input);
  const actions = document.createElement("div");
  actions.className = "xl-dialog-actions";
  const findAll = document.createElement("button");
  findAll.className = "xl-btn xl-btn-primary";
  findAll.textContent = "查找全部(I)";
  const cancel = document.createElement("button");
  cancel.className = "xl-btn";
  cancel.textContent = "关闭";
  actions.append(findAll, cancel);
  body.append(row, actions);
  dialog.append(title, body);
  host.append(dialog);
  input.focus();

  const close = () => dialog.remove();
  const submit = () => {
    const keyword = input.value.trim();
    if (!keyword) return;
    close();
    onSubmit(keyword);
  };
  input.addEventListener("keydown", (event) => {
    // 对话框内按键不冒泡到网格，避免方向键/回车误操作
    event.stopPropagation();
    if (event.key === "Enter") { event.preventDefault(); submit(); }
    if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  findAll.addEventListener("click", submit);
  cancel.addEventListener("click", close);
  closeX.addEventListener("click", close);
  return close;
}
