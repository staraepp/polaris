import { describe, expect, it } from "vite-plus/test";

import { PHONE_BACKGROUND_RECONNECT_AFTER_MS, webResumeWakeup } from "./webResumeWakeup";

describe("webResumeWakeup", () => {
  it("reconnects a phone at once after a long absence", () => {
    expect(
      webResumeWakeup({
        touchFirst: true,
        hiddenAtMs: 1_000,
        visibleAtMs: 1_000 + PHONE_BACKGROUND_RECONNECT_AFTER_MS,
      }),
    ).toBe("application-active-reconnect");
  });

  it("probes a phone after a short glance away", () => {
    expect(webResumeWakeup({ touchFirst: true, hiddenAtMs: 1_000, visibleAtMs: 4_000 })).toBe(
      "application-active",
    );
  });

  it("keeps probing on desktop browsers however long the tab was hidden", () => {
    expect(
      webResumeWakeup({ touchFirst: false, hiddenAtMs: 0, visibleAtMs: 60 * 60 * 1_000 }),
    ).toBe("application-active");
  });

  it("probes when it never saw the tab hide", () => {
    expect(webResumeWakeup({ touchFirst: true, hiddenAtMs: null, visibleAtMs: 99_000 })).toBe(
      "application-active",
    );
  });
});
