// 逃生舱：「文件 → 在浏览器中打开原网页」对目标地址的下一次加载跳过 Excel 模式（仅一次、仅同一地址）
const BYPASS_KEY = "omchh-excel-bypass";

export function setExcelBypass(href: string): void {
  try { sessionStorage.setItem(BYPASS_KEY, href); } catch { /* 隐私模式下无法逃生，保持 Excel 模式 */ }
}

export function consumeExcelBypass(href: string): boolean {
  try {
    if (sessionStorage.getItem(BYPASS_KEY) !== href) return false;
    sessionStorage.removeItem(BYPASS_KEY);
    return true;
  } catch {
    return false;
  }
}
