import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  INITIAL_QUOTA_LOW_STATE,
  isQuotaLow,
  quotaWindowsOf,
  stepQuotaLow,
  type QuotaLowWindowReading,
} from "./quotaLow";

const win = (
  id: string,
  remainingPercent: number,
  kind: QuotaLowWindowReading["kind"] = "weekly",
) => ({ id, kind, label: id, remainingPercent }) satisfies QuotaLowWindowReading;

const step = (
  previous = INITIAL_QUOTA_LOW_STATE,
  windows: readonly QuotaLowWindowReading[],
  now = 1_000,
  providerKey: string | null = "claude",
) => stepQuotaLow(previous, { providerKey, windows, now });

describe("stepQuotaLow", () => {
  it("flashes once when a window crosses below the threshold and then stays low", () => {
    const first = step(undefined, [win("weekly", 25)]);
    expect(isQuotaLow(first)).toBe(false);
    expect(first.flashAt).toBeNull();

    const crossed = step(first, [win("weekly", 19)], 2_000);
    expect(isQuotaLow(crossed)).toBe(true);
    expect(crossed.flashAt).toBe(2_000);

    const stillLow = step(crossed, [win("weekly", 10)], 3_000);
    expect(stillLow.flashAt).toBe(2_000);
    expect(stillLow.lowWindows.map((window) => window.remainingPercent)).toEqual([10]);
  });

  it("treats exactly the threshold as low", () => {
    expect(isQuotaLow(step(undefined, [win("weekly", 20)]))).toBe(true);
  });

  it("re-arms only after recovering past the hysteresis band", () => {
    const low = step(undefined, [win("weekly", 15)], 1_000);
    const recovering = step(low, [win("weekly", 23)], 2_000);
    expect(isQuotaLow(recovering)).toBe(false);
    const lowAgain = step(recovering, [win("weekly", 18)], 3_000);
    expect(lowAgain.flashAt).toBe(1_000);

    const recovered = step(lowAgain, [win("weekly", 25)], 4_000);
    const flashesAgain = step(recovered, [win("weekly", 18)], 5_000);
    expect(flashesAgain.flashAt).toBe(5_000);
  });

  it("watches the 5-hour session window as well as the others", () => {
    const state = step(undefined, [win("five_hour", 5, "session"), win("weekly", 80)]);
    expect(state.lowWindows.map((window) => window.id)).toEqual(["five_hour"]);
    expect(state.flashAt).toBe(1_000);
  });

  it("flashes per window, so a second window crossing later flashes too", () => {
    const first = step(undefined, [win("a", 10), win("b", 50)], 1_000);
    const second = step(first, [win("a", 10), win("b", 12)], 2_000);
    expect(second.flashAt).toBe(2_000);
    expect(second.lowWindows.map((window) => window.id)).toEqual(["a", "b"]);
  });

  it("re-arms on a provider switch and flashes if the new provider is already low", () => {
    const low = step(undefined, [win("weekly", 10)], 1_000, "claude");
    const switched = step(low, [win("weekly", 10)], 2_000, "codex");
    expect(switched.flashAt).toBe(2_000);
    const switchedHigh = step(low, [win("weekly", 90)], 3_000, "codex");
    expect(switchedHigh.flashAt).toBeNull();
    expect(isQuotaLow(switchedHigh)).toBe(false);
  });

  it("is silent without windows and forgets windows that disappear", () => {
    const empty = step(undefined, [], 1_000);
    expect(isQuotaLow(empty)).toBe(false);
    expect(empty.flashAt).toBeNull();
    const low = step(empty, [win("weekly", 5)], 2_000);
    const gone = step(low, [], 3_000);
    expect(gone.disarmed.size).toBe(0);
    expect(isQuotaLow(gone)).toBe(false);
  });

  it("returns the same object when nothing changed", () => {
    const state = step(undefined, [win("weekly", 10)]);
    expect(step(state, [win("weekly", 10)], 9_000)).toBe(state);
  });

  it("honors a custom threshold and hysteresis", () => {
    const state = stepQuotaLow(INITIAL_QUOTA_LOW_STATE, {
      providerKey: "p",
      windows: [win("weekly", 40)],
      now: 1,
      thresholdPercent: 50,
      hysteresisPoints: 10,
    });
    expect(isQuotaLow(state)).toBe(true);
    const notYet = stepQuotaLow(state, {
      providerKey: "p",
      windows: [win("weekly", 59)],
      now: 2,
      thresholdPercent: 50,
      hysteresisPoints: 10,
    });
    expect(notYet.disarmed.has("weekly")).toBe(true);
  });
});

describe("quotaWindowsOf", () => {
  const provider = (usageLimits: ServerProvider["usageLimits"]) =>
    ({ usageLimits }) as unknown as ServerProvider;

  it("converts used percent to remaining and keeps every kind", () => {
    const readings = quotaWindowsOf(
      provider({
        checkedAt: "2026-10-05T00:00:00.000Z",
        windows: [
          { id: "five_hour", kind: "session", label: "5h", usedPercent: 82 },
          { id: "weekly", kind: "weekly", label: "Week", usedPercent: 30.4 },
        ],
      }),
    );
    expect(readings).toEqual([
      { id: "five_hour", kind: "session", label: "5h", remainingPercent: 18 },
      { id: "weekly", kind: "weekly", label: "Week", remainingPercent: 70 },
    ]);
  });

  it("is empty for a missing provider, no limits, or an unavailable account", () => {
    expect(quotaWindowsOf(null)).toEqual([]);
    expect(quotaWindowsOf(provider(undefined))).toEqual([]);
    expect(
      quotaWindowsOf(
        provider({
          checkedAt: "2026-10-05T00:00:00.000Z",
          windows: [{ id: "weekly", kind: "weekly", label: "Week", usedPercent: 99 }],
          unavailable: { reason: "probeFailed" },
        }),
      ),
    ).toEqual([]);
  });
});
