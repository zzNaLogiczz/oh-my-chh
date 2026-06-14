import { noopSelectorTracker, type SelectorTracker } from "./context";

let activeSelectorTracker: SelectorTracker = noopSelectorTracker;

export function withSelectorTracker<T>(tracker: SelectorTracker, run: () => T): T {
  const previous = activeSelectorTracker;
  activeSelectorTracker = tracker;
  try {
    return run();
  } finally {
    activeSelectorTracker = previous;
  }
}

export function trackSelector(adapter: string, selector: string, count: number, required = false): void {
  activeSelectorTracker(adapter, selector, count, required);
}
