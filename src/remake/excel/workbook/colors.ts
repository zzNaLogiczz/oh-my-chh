// Excel 颜色解析：argb / 主题色 + tint / 索引色 → CSS #rrggbb

/** Office 2013+ 默认主题，按 Excel 主题索引排列（0=lt1 背景、1=dk1 文本、2=lt2、3=dk2、4–9 accent、10 hlink、11 folHlink） */
export const DEFAULT_THEME_PALETTE = [
  "FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"
];

/** Excel 旧版 64 色索引表（含 64/65 系统前景/背景） */
const INDEXED_COLORS = [
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
  "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
  "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
  "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
  "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
  "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
  "000000", "FFFFFF"
];

// 主题 XML 中 clrScheme 子元素顺序为 dk1, lt1, dk2, lt2, accent1–6, hlink, folHlink
const SCHEME_ORDER = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const SCHEME_TO_INDEX: Record<string, number> = { lt1: 0, dk1: 1, lt2: 2, dk2: 3 };

export function parseThemePalette(themeXml: string | undefined): string[] {
  const palette = [...DEFAULT_THEME_PALETTE];
  if (!themeXml) return palette;
  SCHEME_ORDER.forEach((name, order) => {
    const block = themeXml.match(new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`));
    const hex = block?.[1].match(/(?:lastClr|val)="([0-9A-Fa-f]{6})"/)?.[1];
    if (hex) palette[SCHEME_TO_INDEX[name] ?? order] = hex.toUpperCase();
  });
  return palette;
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
  return "#" + [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, "0")).join("");
}

/** Excel tint：负值按比例变暗，正值向白色提亮（作用于 HSL 亮度） */
export function applyTint(hex: string, tint: number): string {
  if (!tint) return hex.toLowerCase();
  const [h, s, l] = toHsl(hex);
  const next = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  return fromHsl(h, s, next);
}

export interface ExcelColor { argb?: string; theme?: number; tint?: number; indexed?: number }

export function resolveColor(color: ExcelColor | undefined, palette: string[]): string | null {
  if (!color) return null;
  let hex: string | undefined;
  if (typeof color.argb === "string" && /^[0-9A-Fa-f]{6,8}$/.test(color.argb)) hex = color.argb.slice(-6);
  else if (typeof color.theme === "number") hex = palette[color.theme];
  else if (typeof color.indexed === "number") hex = INDEXED_COLORS[color.indexed];
  if (!hex) return null;
  return applyTint(`#${hex}`, color.tint ?? 0).toLowerCase();
}
