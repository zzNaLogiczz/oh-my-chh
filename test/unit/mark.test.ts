import { afterEach, describe, expect, it, vi } from "vitest";
import { addEnhancedToken, markAll, markElement, setData } from "../../src/foundation/mark";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("foundation mark helpers", () => {
  it("does not rewrite class or enhanced token when an element is already marked", () => {
    const element = document.createElement("div");
    const classAdd = vi.spyOn(element.classList, "add");
    const setAttribute = vi.spyOn(element, "setAttribute");

    expect(markElement(element, "omchh-card", "thread-detail")).toBe(true);
    expect(markElement(element, "omchh-card", "thread-detail")).toBe(true);

    expect(classAdd).toHaveBeenCalledTimes(1);
    expect(setAttribute).toHaveBeenCalledTimes(1);
    expect(element.classList.contains("omchh-card")).toBe(true);
    expect(element.getAttribute("data-omchh-enhanced")).toBe("thread-detail");
  });

  it("does not rebuild the enhanced token attribute when the token already exists", () => {
    const element = document.createElement("div");
    element.setAttribute("data-omchh-enhanced", "common thread-detail");
    const setAttribute = vi.spyOn(element, "setAttribute");

    addEnhancedToken(element, "thread-detail");

    expect(setAttribute).not.toHaveBeenCalled();
    expect(element.getAttribute("data-omchh-enhanced")).toBe("common thread-detail");
  });

  it("keeps markAll count stable across repeated runs", () => {
    document.body.innerHTML = `<section id="root"><p></p><p></p></section>`;
    const root = document.querySelector("#root") as HTMLElement;

    expect(markAll(root, "p", "omchh-copy", "common")).toBe(2);
    expect(markAll(root, "p", "omchh-copy", "common")).toBe(2);

    document.querySelectorAll("p").forEach((element) => {
      expect(element.classList.contains("omchh-copy")).toBe(true);
      expect(element.getAttribute("data-omchh-enhanced")).toBe("common");
    });
  });

  it("repairs a class stripped by the site without rewriting an existing token", () => {
    const element = document.createElement("div");
    markElement(element, "omchh-post", "thread-detail");
    element.classList.remove("omchh-post");
    const setAttribute = vi.spyOn(element, "setAttribute");
    const classAdd = vi.spyOn(element.classList, "add");

    expect(markElement(element, "omchh-post", "thread-detail")).toBe(true);

    expect(classAdd).toHaveBeenCalledWith("omchh-post");
    expect(setAttribute).not.toHaveBeenCalled();
    expect(element.classList.contains("omchh-post")).toBe(true);
    expect(element.getAttribute("data-omchh-enhanced")).toBe("thread-detail");
  });

  it("repairs an enhanced token stripped by the site while preserving the class", () => {
    const element = document.createElement("div");
    markElement(element, "omchh-post", "thread-detail");
    element.removeAttribute("data-omchh-enhanced");
    const classAdd = vi.spyOn(element.classList, "add");
    const setAttribute = vi.spyOn(element, "setAttribute");

    expect(markElement(element, "omchh-post", "thread-detail")).toBe(true);

    expect(classAdd).not.toHaveBeenCalled();
    expect(setAttribute).toHaveBeenCalledWith("data-omchh-enhanced", "thread-detail");
    expect(element.classList.contains("omchh-post")).toBe(true);
    expect(element.getAttribute("data-omchh-enhanced")).toBe("thread-detail");
  });

  it("does not emit a mutation when setData receives the existing value", async () => {
    const element = document.createElement("div");
    element.dataset.omchhRoute = "thread-detail";
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(element, { attributes: true, attributeFilter: ["data-omchh-route"] });

    setData(element, "omchhRoute", "thread-detail");
    await Promise.resolve();
    expect(mutations).toHaveLength(0);

    setData(element, "omchhRoute", "thread-list");
    await Promise.resolve();
    observer.disconnect();

    expect(mutations.map((mutation) => mutation.attributeName)).toEqual(["data-omchh-route"]);
    expect(element.dataset.omchhRoute).toBe("thread-list");
  });
});
