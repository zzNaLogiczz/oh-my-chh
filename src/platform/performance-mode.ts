import type { OmchhSettingsShape } from "../shared/preferences-shape";
import type { OmchhRoute } from "../foundation/route";

export type PerformanceMode = "normal" | "reduced";
export type PostCountTier = "none" | "small" | "medium" | "large";
export type PerformanceReason = "settings" | "long-thread" | "low-memory" | "normal";

export interface PerformanceState {
  mode: PerformanceMode;
  postCount: number;
  postCountTier: PostCountTier;
  reason: PerformanceReason;
}

export function countThreadPosts(root: ParentNode = document): number {
  return root.querySelectorAll("#postlist > div[id^='post_']").length;
}

export function postCountTier(count: number): PostCountTier {
  if (count <= 0) return "none";
  if (count < 20) return "small";
  if (count < 40) return "medium";
  return "large";
}

function deviceMemory(): number | undefined {
  const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
  const memory = nav?.deviceMemory;
  return typeof memory === "number" && Number.isFinite(memory) ? memory : undefined;
}

export function computePerformanceState(route: OmchhRoute, settings: OmchhSettingsShape, root: ParentNode = document): PerformanceState {
  const postCount = route === "thread-detail" ? countThreadPosts(root) : 0;
  const tier = postCountTier(postCount);

  if (settings.reduceGlass || settings.reduceMotion) {
    return { mode: "reduced", postCount, postCountTier: tier, reason: "settings" };
  }

  if (route === "thread-detail" && postCount >= 40) {
    return { mode: "reduced", postCount, postCountTier: tier, reason: "long-thread" };
  }

  const memory = deviceMemory();
  if (route === "thread-detail" && postCount >= 20 && typeof memory === "number" && memory <= 4) {
    return { mode: "reduced", postCount, postCountTier: tier, reason: "low-memory" };
  }

  return { mode: "normal", postCount, postCountTier: tier, reason: "normal" };
}

function setDatasetValue(root: HTMLElement, key: "omchhPerformance" | "omchhPostCountTier", value: string): void {
  const attributeName = key === "omchhPerformance" ? "data-omchh-performance" : "data-omchh-post-count-tier";
  if (root.dataset[key] !== value) root.setAttribute(attributeName, value);
}

export function applyPerformanceRoot(state: PerformanceState, root: HTMLElement = document.documentElement): void {
  setDatasetValue(root, "omchhPerformance", state.mode);
  setDatasetValue(root, "omchhPostCountTier", state.postCountTier);
}
