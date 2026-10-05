import type { ServerProvider, ServerProviderUsageWindow } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";

/** Remaining quota (percent) at or below which a window counts as low. A setting later; see HANDOFF. */
export const QUOTA_LOW_THRESHOLD_PERCENT = 20;
/** Points above the threshold a window must recover before it can flash again. */
export const QUOTA_LOW_HYSTERESIS_POINTS = 5;
/** How long the one-shot flash lasts before the static accent takes over. */
export const QUOTA_LOW_FLASH_MS = 4_000;

export interface QuotaLowWindowReading {
  readonly id: string;
  readonly kind: ServerProviderUsageWindow["kind"];
  readonly label: string;
  readonly remainingPercent: number;
}

export interface QuotaLowState {
  /** The provider the arming state belongs to; a switch re-arms everything. */
  readonly providerKey: string | null;
  /** Window ids that have already flashed and not yet recovered. */
  readonly disarmed: ReadonlySet<string>;
  /** Windows currently at or below the threshold, in the provider's order. */
  readonly lowWindows: readonly QuotaLowWindowReading[];
  /** When the latest crossing happened, or null before any. */
  readonly flashAt: number | null;
}

export const INITIAL_QUOTA_LOW_STATE: QuotaLowState = {
  providerKey: null,
  disarmed: new Set(),
  lowWindows: [],
  flashAt: null,
};

/**
 * The windows the signal watches: every window the provider reports, the
 * 5-hour `session` one included. Silent (empty) when the account cannot report
 * limits or the last probe failed, so a stale reading never raises an alarm.
 */
export function quotaWindowsOf(provider: ServerProvider | null): readonly QuotaLowWindowReading[] {
  const limits = provider?.usageLimits;
  if (limits === undefined || limits.unavailable !== undefined) return [];
  return limits.windows.map((window) => ({
    id: window.id,
    kind: window.kind,
    label: window.label,
    remainingPercent: remainingPercent(window),
  }));
}

export function stepQuotaLow(
  previous: QuotaLowState,
  input: {
    readonly providerKey: string | null;
    readonly windows: readonly QuotaLowWindowReading[];
    readonly now: number;
    readonly thresholdPercent?: number;
    readonly hysteresisPoints?: number;
  },
): QuotaLowState {
  const threshold = input.thresholdPercent ?? QUOTA_LOW_THRESHOLD_PERCENT;
  const rearmAt = threshold + (input.hysteresisPoints ?? QUOTA_LOW_HYSTERESIS_POINTS);
  const switched = previous.providerKey !== input.providerKey;
  const disarmed = new Set(switched ? [] : previous.disarmed);
  let crossed = false;
  const lowWindows: QuotaLowWindowReading[] = [];
  for (const window of input.windows) {
    if (window.remainingPercent <= threshold) {
      lowWindows.push(window);
      if (!disarmed.has(window.id)) {
        disarmed.add(window.id);
        crossed = true;
      }
    } else if (window.remainingPercent >= rearmAt) {
      disarmed.delete(window.id);
    }
  }
  // Forget windows the provider no longer reports.
  for (const id of disarmed) {
    if (!input.windows.some((window) => window.id === id)) disarmed.delete(id);
  }
  const next: QuotaLowState = {
    providerKey: input.providerKey,
    disarmed,
    lowWindows,
    flashAt: crossed ? input.now : switched ? null : previous.flashAt,
  };
  return sameState(previous, next) ? previous : next;
}

export function isQuotaLow(state: QuotaLowState): boolean {
  return state.lowWindows.length > 0;
}

function sameState(a: QuotaLowState, b: QuotaLowState): boolean {
  if (a.providerKey !== b.providerKey || a.flashAt !== b.flashAt) return false;
  if (a.disarmed.size !== b.disarmed.size || [...a.disarmed].some((id) => !b.disarmed.has(id))) {
    return false;
  }
  return (
    a.lowWindows.length === b.lowWindows.length &&
    a.lowWindows.every(
      (window, index) =>
        window.id === b.lowWindows[index]?.id &&
        window.remainingPercent === b.lowWindows[index]?.remainingPercent,
    )
  );
}
