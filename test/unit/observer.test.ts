import { afterEach, describe, expect, it, vi } from "vitest";
import { createObserverScheduler } from "../../src/foundation/observer";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("observer scheduler", () => {
  it("reruns adapters when Discuz changes append_parent popups outside #wp", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="append_parent"></div>
      <div id="wp"><div id="ct"></div></div>
    `;
    const run = vi.fn();
    const scheduler = createObserverScheduler(run);

    scheduler.start();
    document.querySelector("#append_parent")?.append(document.createElement("div"));

    await Promise.resolve();
    vi.advanceTimersByTime(50);
    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });
});
