import { useMemo, useState } from "react";

import {
  deriveThreadUsage,
  sameThreadUsage,
  type ThreadUsage,
  type ThreadUsageInput,
} from "./threadUsage";

/**
 * Per-thread usage that keeps its identity while the figures are unchanged:
 * the projection updates on every streamed delta, and the composer is memoised.
 */
export function useThreadUsage(projection: ThreadUsageInput | null): ThreadUsage | null {
  const next = useMemo(
    () => (projection === null ? null : deriveThreadUsage(projection)),
    [projection],
  );
  const [stable, setStable] = useState(next);
  const same = sameThreadUsage(stable, next);
  // Adjusting state while rendering: React re-renders this component at once.
  if (!same) setStable(next);
  return same ? stable : next;
}
