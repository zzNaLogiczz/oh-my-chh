import { describe, expect, it } from "vitest";
import { formatShortcut, matchesShortcut, shortcutFromEvent, type KeyLike } from "../../src/remake/excel/keys";

const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  code,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods
});

describe("excel shortcuts", () => {
  it("matches by physical key code and exact modifiers", () => {
    expect(matchesShortcut(key("Digit1", { altKey: true }), "Alt+Digit1")).toBe(true);
    expect(matchesShortcut(key("Digit1", { altKey: true, shiftKey: true }), "Alt+Digit1")).toBe(false);
    expect(matchesShortcut(key("Digit2", { altKey: true }), "Alt+Digit1")).toBe(false);
  });

  it("never matches during IME composition", () => {
    expect(matchesShortcut(key("Digit1", { altKey: true, isComposing: true }), "Alt+Digit1")).toBe(false);
  });

  it("records shortcuts with a fixed modifier order and ignores bare modifiers", () => {
    expect(shortcutFromEvent(key("AltLeft", { altKey: true }))).toBeNull();
    expect(shortcutFromEvent(key("KeyQ", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+KeyQ");
    expect(shortcutFromEvent(key("Digit1", { altKey: true, metaKey: true }))).toBe("Alt+Meta+Digit1");
  });

  it("formats codes for display", () => {
    expect(formatShortcut("Alt+Digit1")).toBe("Alt+1");
    expect(formatShortcut("Ctrl+KeyQ")).toBe("Ctrl+Q");
    expect(formatShortcut("Ctrl+Shift+Backquote")).toBe("Ctrl+Shift+`");
  });
});
