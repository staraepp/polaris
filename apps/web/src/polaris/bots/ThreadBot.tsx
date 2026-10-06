import { useEffect, useState } from "react";

import type { EffortTier } from "../fx/effortTier";
import { ORBIE_NAME, ORBIE_STATE_BY_STATUS, orbieStatusFor } from "./orbie";
import { OrbieAvatar } from "./OrbieAvatar";

/** Re-reads the clock once a minute: enough to notice a thread going stale. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, []);
  return now;
}

/**
 * Orbie in the thread header (Polaris): its state follows the thread (see
 * `ORBIE_STATE_BY_STATUS`) and, while a run works, it takes that run's frozen
 * effort tier color.
 */
export function ThreadBot({
  running,
  waitingOnUser,
  lastActivityAt,
  tier,
  project = null,
}: {
  readonly running: boolean;
  readonly waitingOnUser: boolean;
  readonly lastActivityAt: number | null;
  readonly tier: EffortTier;
  /** The thread's project name: the header shows that project's bot. */
  readonly project?: string | null;
}) {
  const now = useMinuteClock();
  const state =
    ORBIE_STATE_BY_STATUS[orbieStatusFor({ running, waitingOnUser, lastActivityAt, now })];
  return (
    <OrbieAvatar
      size={28}
      state={state}
      live
      tier={tier}
      label={ORBIE_NAME}
      project={project}
      className="me-2"
    />
  );
}
