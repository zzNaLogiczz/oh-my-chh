const enhancedElements = new WeakSet<Element>();

export function isEditableElement(element: Element | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT|BUTTON)$/i.test(element.tagName);
}

export function isFocusedEditable(element: Element): boolean {
  return document.activeElement === element && isEditableElement(element);
}

export function remember(element: Element): boolean {
  if (enhancedElements.has(element)) return false;
  enhancedElements.add(element);
  return true;
}

export function addEnhancedToken(element: Element, token: string): void {
  const current = new Set((element.getAttribute("data-omchh-enhanced") ?? "").split(/\s+/).filter(Boolean));
  current.add(token);
  element.setAttribute("data-omchh-enhanced", [...current].join(" "));
}

export function markElement(element: Element | null, className: string, token = className): element is Element {
  if (!element || isFocusedEditable(element)) return false;
  element.classList.add(className);
  addEnhancedToken(element, token);
  remember(element);
  return true;
}

export function markAll(root: ParentNode, selector: string, className: string, token = className): number {
  let count = 0;
  root.querySelectorAll(selector).forEach((element) => {
    if (markElement(element, className, token)) count += 1;
  });
  return count;
}

export function setData(element: Element | null, key: string, value: string): void {
  if (!element || isFocusedEditable(element)) return;
  (element as HTMLElement).dataset[key] = value;
}
