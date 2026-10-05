import type { ServerProvider } from "@t3tools/contracts";
import { useEffect, useMemo, useState } from "react";

import {
  INITIAL_QUOTA_LOW_STATE,
  isQuotaLow,
  QUOTA_LOW_FLASH_MS,
  QUOTA_LOW_THRESHOLD_PERCENT,
  quotaWindowsOf,
  stepQuotaLow,
  type QuotaLowState,
  type QuotaLowWindowReading,
} from "./quotaLow";

export interface QuotaLowSignal {
  /** Some watched window of the active provider is at or below the threshold. */
  readonly low: boolean;
  /** The one-shot flash is running (false under reduced motion). */
  readonly flashing: boolean;
  /** The windows that are low, for the usage meter and tooltips. */
  readonly lowWindows: readonly QuotaLowWindowReading[];
  readonly thresholdPercent: number;
}

const IDLE_SIGNAL: QuotaLowSignal = {
  low: false,
  flashing: false,
  lowWindows: [],
  thresholdPercent: QUOTA_LOW_THRESHOLD_PERCENT,
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Tracks the active provider's quota windows and raises a one-shot flash when
 * one crosses below the threshold, then a persistent "low" signal while it
 * stays there. Pure logic lives in `quotaLow.ts`; this hook only adds the
 * provider snapshot and the 4-second timer.
 */
export function useQuotaLowSignal(
  provider: ServerProvider | null,
  thresholdPercent: number = QUOTA_LOW_THRESHOLD_PERCENT,
): QuotaLowSignal {
  // A threshold of 0 turns the signal off: no windows means silence.
  const providerKey = provider?.instanceId ?? null;
  const windows = useMemo(
    () => (thresholdPercent > 0 ? quotaWindowsOf(provider) : []),
    [provider, thresholdPercent],
  );
  const [state, setState] = useState<QuotaLowState>(INITIAL_QUOTA_LOW_STATE);
  const [flashing, setFlashing] = useState(false);

  // An unchanged snapshot steps to the same state object, so nothing re-renders.
  useEffect(() => {
    setState((previous) =>
      stepQuotaLow(previous, { providerKey, windows, now: Date.now(), thresholdPercent }),
    );
  }, [providerKey, windows, thresholdPercent]);

  useEffect(() => {
    if (state.flashAt === null || prefersReducedMotion()) {
      setFlashing(false);
      return;
    }
    const remaining = state.flashAt + QUOTA_LOW_FLASH_MS - Date.now();
    if (remaining <= 0) {
      setFlashing(false);
      return;
    }
    setFlashing(true);
    const handle = setTimeout(() => setFlashing(false), remaining);
    return () => clearTimeout(handle);
  }, [state.flashAt]);

  return useMemo(
    () =>
      state === INITIAL_QUOTA_LOW_STATE
        ? IDLE_SIGNAL
        : {
            low: isQuotaLow(state),
            // A flash outlives its cause if the warning is switched off mid-burst.
            flashing: flashing && isQuotaLow(state),
            lowWindows: state.lowWindows,
            thresholdPercent,
          },
    [state, flashing, thresholdPercent],
  );
}
