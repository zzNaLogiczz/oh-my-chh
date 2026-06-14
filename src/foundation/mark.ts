export function isEditableElement(element: Element | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT|BUTTON)$/i.test(element.tagName);
}

export function isFocusedEditable(element: Element): boolean {
  return document.activeElement === element && isEditableElement(element);
}

function hasEnhancedToken(attrValue: string | null, token: string): boolean {
  return !!attrValue && ` ${attrValue} `.includes(` ${token} `);
}

export function addEnhancedToken(element: Element, token: string): void {
  const attr = element.getAttribute("data-omchh-enhanced");
  if (hasEnhancedToken(attr, token)) return;
  const current = new Set((attr ?? "").split(/\s+/).filter(Boolean));
  current.add(token);
  element.setAttribute("data-omchh-enhanced", [...current].join(" "));
}

export function markElement(element: Element | null, className: string, token = className): element is Element {
  if (!element || isFocusedEditable(element)) return false;
  const attr = element.getAttribute("data-omchh-enhanced");
  const hasClass = element.classList.contains(className);
  const hasToken = hasEnhancedToken(attr, token);
  if (hasClass && hasToken) return true;
  if (!hasClass) element.classList.add(className);
  if (!hasToken) addEnhancedToken(element, token);
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
  const el = element as HTMLElement;
  if (el.dataset[key] === value) return;
  el.dataset[key] = value;
}
