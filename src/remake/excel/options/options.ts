// Excel 伪装皮肤的工作簿导入页：拖入 / 选择 .xlsx、查看当前工作簿、移除（快捷键与显示设置在工具栏弹窗里）
import ExcelJS from "exceljs";
import { loadExcelPrefs, saveExcelPrefs } from "../prefs";
import { WorkbookTooLargeError, type WorkbookModel } from "../workbook/model";
import { normalizeWorkbook } from "../workbook/normalize";
import { deleteWorkbook, loadWorkbookInfo, saveWorkbook, type WorkbookInfo } from "../workbook/store";
import { normalizeXlsxPackage, NotXlsxError } from "./ooxml";

// 导入失败时给用户看的中文原因；技术细节只写进控制台
const READ_FAILED = "无法读取该文件，请重试";
const NOT_XLSX = "这不是 .xlsx 文件，请在 Excel 中另存为 .xlsx 后再导入";
const UNSUPPORTED_FORMAT = "文件含有不支持的格式，请不要上传包含复杂格式的 Excel";
const SAVE_FAILED = "保存失败，请重试";

export interface OptionsDeps {
  readFile?: (file: File) => Promise<ArrayBuffer>;
  loadWorkbookFile?: (buffer: ArrayBuffer, fileName: string) => Promise<WorkbookModel>;
}

async function parseXlsx(buffer: ArrayBuffer, fileName: string): Promise<WorkbookModel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await normalizeXlsxPackage(buffer));
  return normalizeWorkbook(wb, fileName);
}

const TEMPLATE = `
  <main class="opt">
    <h1 class="opt-title"><img class="opt-logo" src="../icons/chh-icon-48.png" alt="" width="24" height="24">导入工作簿</h1>
    <label class="opt-drop" id="drop-zone" for="excel-file">
      <span class="opt-drop-icon" aria-hidden="true"></span>
      <span class="opt-drop-main">拖入 .xlsx 或点击选择</span>
      <input id="excel-file" type="file" accept=".xlsx">
    </label>
    <section class="opt-current" id="workbook" hidden>
      <span class="opt-file-icon" aria-hidden="true">XLSX</span>
      <span class="opt-file">
        <span class="opt-file-name" id="workbook-name"></span>
        <span class="opt-file-meta" id="workbook-meta"></span>
      </span>
      <button id="delete-workbook" type="button" class="opt-remove">移除</button>
    </section>
    <div id="status" class="opt-status" role="status" aria-live="polite"></div>
  </main>`;

function renderWorkbook(root: HTMLElement, info: WorkbookInfo | null): void {
  const box = root.querySelector<HTMLElement>("#workbook")!;
  box.hidden = !info;
  if (!info) return;
  root.querySelector("#workbook-name")!.textContent = info.fileName;
  const date = new Date(info.importedAt).toLocaleDateString("zh-CN");
  root.querySelector("#workbook-meta")!.textContent = `${info.sheetCount} 个工作表 · ${date}${info.truncated ? " · 超出 1000 行 × 100 列的部分已截断" : ""}`;
}

export async function mountOptionsPage(root: HTMLElement, deps: OptionsDeps = {}): Promise<void> {
  const readFile = deps.readFile ?? ((file: File) => file.arrayBuffer());
  const loadFile = deps.loadWorkbookFile ?? parseXlsx;
  root.innerHTML = TEMPLATE;
  const status = (message: string, failed = false) => {
    const node = root.querySelector<HTMLElement>("#status")!;
    node.textContent = message;
    node.classList.toggle("is-error", failed);
  };
  renderWorkbook(root, await loadWorkbookInfo());

  const fail = (message: string, error: unknown) => {
    // 用户只看中文原因；原始错误留在控制台，排查时用
    console.warn("[oh-my-chh] 导入工作簿失败：", error);
    status(message, true);
  };

  /** 读文件 → 解析；失败按原因给出中文提示并返回 null */
  const parseFile = async (file: File): Promise<WorkbookModel | null> => {
    let buffer: ArrayBuffer;
    try {
      buffer = await readFile(file);
    } catch (error) {
      fail(READ_FAILED, error);
      return null;
    }
    try {
      return await loadFile(buffer, file.name);
    } catch (error) {
      // 解析库读不了的结构（以及我们没覆盖到的写法）统一提示“格式不支持”，不把英文报错甩给用户
      fail(error instanceof NotXlsxError ? NOT_XLSX : UNSUPPORTED_FORMAT, error);
      return null;
    }
  };

  // 导入：解析 → 体积检查并存储 → 窗口标题默认改成真实文件名
  const importFile = async (file: File) => {
    status(`正在读取 ${file.name}…`);
    const model = await parseFile(file);
    if (!model) return;
    try {
      await saveWorkbook(model);
      await saveExcelPrefs({ ...(await loadExcelPrefs()), displayName: file.name });
    } catch (error) {
      fail(error instanceof WorkbookTooLargeError ? `文件过大：${error.message}` : SAVE_FAILED, error);
      return;
    }
    renderWorkbook(root, await loadWorkbookInfo());
    status(`已导入 ${file.name}`);
  };

  const input = root.querySelector<HTMLInputElement>("#excel-file")!;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void importFile(file);
    input.value = "";
  });

  // 拖放：进入时高亮，放下即导入
  const zone = root.querySelector<HTMLElement>("#drop-zone")!;
  zone.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("is-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-over");
    const file = (event as DragEvent).dataTransfer?.files?.[0];
    if (file) void importFile(file);
  });

  root.querySelector<HTMLButtonElement>("#delete-workbook")!.addEventListener("click", () => {
    void deleteWorkbook().then(() => {
      renderWorkbook(root, null);
      status("已移除工作簿");
    });
  });
}
