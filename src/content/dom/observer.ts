export interface ObserverScheduler {
  start(): void;
  stop(): void;
  requestRun(): void;
}

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number };
type IdleCallbackLike = (deadline: IdleDeadlineLike) => void;
type RequestIdleLike = (callback: IdleCallbackLike, options?: { timeout: number }) => number;

const requestIdle: RequestIdleLike = globalThis.requestIdleCallback
  ? (callback, options) => globalThis.requestIdleCallback(callback, options)
  : (callback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 50);

const cancelIdle = globalThis.cancelIdleCallback
  ? (handle: number): void => globalThis.cancelIdleCallback(handle)
  : (handle: number): void => window.clearTimeout(handle);

export function createObserverScheduler(run: () => void): ObserverScheduler {
  let observer: MutationObserver | undefined;
  let scheduled: number | undefined;

  const requestRun = (): void => {
    if (scheduled !== undefined) return;
    scheduled = requestIdle(() => {
      scheduled = undefined;
      run();
    }, { timeout: 500 });
  };

  const start = (): void => {
    const target = document.querySelector("#wp") ?? document.querySelector("#ct") ?? document.body;
    if (!target || observer) return;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.type === "attributes")) requestRun();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "id"]
    });
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = undefined;
    if (scheduled !== undefined) {
      cancelIdle(scheduled);
      scheduled = undefined;
    }
  };

  return { start, stop, requestRun };
}
