type Cleanup = () => void;

export class EnhancementScope {
  private cleanups: Cleanup[] = [];

  add(cleanup: Cleanup): void {
    this.cleanups.push(cleanup);
  }

  create<K extends keyof HTMLElementTagNameMap>(tag: K, cls = ""): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    this.add(() => el.remove());
    return el;
  }

  adopt(node: Node): void {
    const parent = node.parentNode;
    const next = node.nextSibling;
    this.add(() => {
      if (!parent) return;
      parent.insertBefore(node, next?.parentNode === parent ? next : null);
    });
  }

  setAttr(el: Element, name: string, value: string): void {
    const had = el.hasAttribute(name);
    const prev = el.getAttribute(name);
    el.setAttribute(name, value);
    this.add(() => {
      if (had) el.setAttribute(name, prev ?? "");
      else el.removeAttribute(name);
    });
  }

  addClass(el: Element, ...cls: string[]): void {
    const added = cls.filter((c) => !el.classList.contains(c));
    if (!added.length) return;
    el.classList.add(...added);
    this.add(() => el.classList.remove(...added));
  }

  setStyle(el: HTMLElement, name: string, value: string): void {
    const prev = el.style.getPropertyValue(name);
    const priority = el.style.getPropertyPriority(name);
    el.style.setProperty(name, value);
    this.add(() => {
      if (prev) el.style.setProperty(name, prev, priority);
      else el.style.removeProperty(name);
    });
  }

  replaceChildren(el: Element, ...nextChildren: Node[]): void {
    const prevChildren = Array.from(el.childNodes);
    el.replaceChildren(...nextChildren);
    this.add(() => el.replaceChildren(...prevChildren));
  }

  listen(t: EventTarget, type: string, fn: EventListener, opt?: AddEventListenerOptions): void {
    t.addEventListener(type, fn, opt);
    this.add(() => t.removeEventListener(type, fn, opt));
  }

  observe(observer: MutationObserver, target: Node, options: MutationObserverInit): void {
    observer.observe(target, options);
    this.add(() => observer.disconnect());
  }

  timeout(id: number | ReturnType<typeof setTimeout>): void {
    this.add(() => clearTimeout(id));
  }

  raf(id: number): void {
    this.add(() => cancelAnimationFrame(id));
  }

  teardown(): void {
    for (let i = this.cleanups.length - 1; i >= 0; i -= 1) {
      this.cleanups[i]();
    }
    this.cleanups = [];
  }
}
