import { describe, expect, it } from "vite-plus/test";

import { ORBIE_STALE_AFTER_MS, ORBIE_STATE_BY_STATUS, orbieStatusFor } from "./orbie";

const now = 1_000_000_000;

describe("orbieStatusFor", () => {
  it("runs, waits, idles and goes stale", () => {
    expect(orbieStatusFor({ running: true, waitingOnUser: true, lastActivityAt: 0, now })).toBe(
      "running",
    );
    expect(orbieStatusFor({ running: false, waitingOnUser: true, lastActivityAt: now, now })).toBe(
      "waiting",
    );
    expect(orbieStatusFor({ running: false, waitingOnUser: false, lastActivityAt: now, now })).toBe(
      "idle",
    );
    expect(
      orbieStatusFor({
        running: false,
        waitingOnUser: false,
        lastActivityAt: now - ORBIE_STALE_AFTER_MS,
        now,
      }),
    ).toBe("stale");
    expect(
      orbieStatusFor({ running: false, waitingOnUser: false, lastActivityAt: null, now }),
    ).toBe("idle");
  });

  it("maps statuses onto the library's three states", () => {
    expect(ORBIE_STATE_BY_STATUS).toEqual({
      running: "working",
      idle: "default",
      waiting: "sleeping",
      stale: "sleeping",
    });
  });
});
