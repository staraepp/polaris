import type { ServerProvider, ServerProviderUsageWindow } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";

/** Bars the trigger draws; the popover lists every window. */
export const USAGE_METER_BARS = 2;

export interface UsageMeterBar {
  readonly id: string;
  readonly label: string;
  readonly remainingPercent: number;
  readonly low: boolean;
}

export interface UsageMeterModel {
  readonly driver: ServerProvider["driver"];
  readonly windows: readonly ServerProviderUsageWindow[];
  readonly bars: readonly UsageMeterBar[];
  /** The tightest window, for the trigger's accessible name. */
  readonly tightest: UsageMeterBar;
  readonly low: boolean;
  readonly thresholdPercent: number;
}

/**
 * What the composer usage meter shows for the selected provider (Polaris).
 * `null` when the account reports no windows or the last probe failed, so
 * the meter disappears instead of showing a stale or empty gauge. "Low" uses
 * the quota-low threshold, so the meter and the outline agree.
 */
export function usageMeterModelOf(
  provider: ServerProvider | null,
  thresholdPercent: number,
): UsageMeterModel | null {
  const limits = provider?.usageLimits;
  if (provider === null || limits === undefined || limits.unavailable !== undefined) return null;
  if (limits.windows.length === 0) return null;
  const bars = limits.windows.map((window): UsageMeterBar => {
    const remaining = remainingPercent(window);
    return {
      id: window.id,
      label: window.label,
      remainingPercent: remaining,
      low: thresholdPercent > 0 && remaining <= thresholdPercent,
    };
  });
  const tightest = bars.reduce((min, bar) =>
    bar.remainingPercent < min.remainingPercent ? bar : min,
  );
  return {
    driver: provider.driver,
    windows: limits.windows,
    bars: bars.slice(0, USAGE_METER_BARS),
    tightest,
    low: bars.some((bar) => bar.low),
    thresholdPercent,
  };
}
