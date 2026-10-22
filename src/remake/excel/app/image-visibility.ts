// 帖子图片可见性：全局默认（有图 / 无图）+ 单条批注覆盖；切换全局时清空所有单条覆盖

export interface ImageVisibility {
  readonly globalDefault: "show" | "hide";
  isVisible(pid: string): boolean;
  toggle(pid: string): void;
  setGlobal(value: "show" | "hide"): void;
}

export function createImageVisibility(initial: "show" | "hide"): ImageVisibility {
  let globalDefault = initial;
  const overrides = new Map<string, boolean>();
  return {
    get globalDefault() { return globalDefault; },
    isVisible(pid) {
      return overrides.get(pid) ?? globalDefault === "show";
    },
    toggle(pid) {
      overrides.set(pid, !this.isVisible(pid));
    },
    setGlobal(value) {
      globalDefault = value;
      overrides.clear();
    }
  };
}
