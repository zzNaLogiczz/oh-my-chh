import { afterEach, describe, expect, it, vi } from "vitest";
import { EnhancementScope } from "../../src/platform/enhancement-scope";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("EnhancementScope", () => {
  it("removes created nodes and restores adopted nodes when the original next sibling is gone", () => {
    const scope = new EnhancementScope();
    const root = document.createElement("div");
    const before = document.createElement("span");
    const adopted = document.createElement("b");
    const after = document.createElement("i");
    const newParent = document.createElement("section");

    before.id = "before";
    adopted.id = "adopted";
    after.id = "after";
    root.append(before, adopted, after);
    document.body.append(root, newParent);

    scope.adopt(adopted);
    newParent.append(adopted);
    after.remove();

    const created = scope.create("button", "owned-node");
    document.body.append(created);

    expect(() => scope.teardown()).not.toThrow();
    expect(document.querySelector(".owned-node")).toBeNull();
    expect(root.lastElementChild).toBe(adopted);
  });

  it("restores attributes, classes, styles, and replaced children in reverse order", () => {
    const scope = new EnhancementScope();
    const host = document.createElement("div");
    const original = document.createElement("em");
    const replacement = document.createElement("strong");
    original.textContent = "original";
    replacement.textContent = "replacement";
    host.append(original);
    document.body.append(host);

    scope.setAttr(host, "data-owned", "true");
    scope.addClass(host, "theme-owned");
    scope.setStyle(host, "color", "red");
    scope.replaceChildren(host, replacement);

    expect(host.getAttribute("data-owned")).toBe("true");
    expect(host.classList.contains("theme-owned")).toBe(true);
    expect(host.style.color).toBe("red");
    expect(host.textContent).toBe("replacement");

    scope.teardown();

    expect(host.hasAttribute("data-owned")).toBe(false);
    expect(host.classList.contains("theme-owned")).toBe(false);
    expect(host.style.color).toBe("");
    expect(host.firstElementChild).toBe(original);
    expect(host.textContent).toBe("original");
  });

  it("cleans event listeners, observers, timeouts, and animation frames", () => {
    vi.useFakeTimers();
    const scope = new EnhancementScope();
    const clickTarget = document.createElement("button");
    const observeTarget = document.createElement("div");
    const onClick = vi.fn();
    const onTimeout = vi.fn();
    const observer = new MutationObserver(() => undefined);
    const disconnect = vi.spyOn(observer, "disconnect");
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    scope.listen(clickTarget, "click", onClick);
    scope.observe(observer, observeTarget, { childList: true });
    scope.timeout(window.setTimeout(onTimeout, 25));
    scope.raf(42);

    scope.teardown();
    clickTarget.click();
    vi.advanceTimersByTime(30);

    expect(onClick).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});
