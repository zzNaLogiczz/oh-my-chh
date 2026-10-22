// 快捷键：按 KeyboardEvent.code（物理键位）匹配，规避 macOS 下 Alt+数字 产生特殊字符

export interface KeyLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}

const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Meta"] as const;
type Modifier = (typeof MODIFIER_ORDER)[number];

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight", "OSLeft", "OSRight"
]);

const DISPLAY_CODES: Record<string, string> = {
  Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Space: "Space", Escape: "Esc"
};

function activeModifiers(event: KeyLike): Modifier[] {
  const flags: Record<Modifier, boolean> = { Ctrl: event.ctrlKey, Alt: event.altKey, Shift: event.shiftKey, Meta: event.metaKey };
  return MODIFIER_ORDER.filter((modifier) => flags[modifier]);
}

export function shortcutFromEvent(event: KeyLike): string | null {
  if (!event.code || MODIFIER_CODES.has(event.code)) return null;
  return [...activeModifiers(event), event.code].join("+");
}

export function matchesShortcut(event: KeyLike, spec: string): boolean {
  if (event.isComposing) return false;
  return shortcutFromEvent(event) === spec;
}

function displayCode(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return DISPLAY_CODES[code] ?? code;
}

export function formatShortcut(spec: string): string {
  const parts = spec.split("+");
  const code = parts.pop() ?? "";
  return [...parts, displayCode(code)].join("+");
}
