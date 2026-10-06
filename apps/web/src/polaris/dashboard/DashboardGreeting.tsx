import { Link } from "@tanstack/react-router";

import { Button } from "~/components/ui/button";

import { ORBIE_NAME } from "../bots/orbie";
import { OrbieAvatar } from "../bots/OrbieAvatar";
import type { DashboardThread } from "./dashboardThreads";

const NEEDS_YOU = new Set(["Pending Approval", "Awaiting Input", "Plan Ready"]);
const BUSY = new Set(["Working", "Connecting"]);

export function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** How many threads are busy and how many wait on the user. */
export function dashboardPulse(active: readonly DashboardThread[]): {
  readonly working: number;
  readonly needsYou: number;
} {
  let working = 0;
  let needsYou = 0;
  for (const entry of active) {
    const label = entry.status?.label;
    if (label === undefined) continue;
    if (NEEDS_YOU.has(label)) needsYou += 1;
    else if (BUSY.has(label)) working += 1;
  }
  return { working, needsYou };
}

/** The thread that wants you most: the first one waiting on you (the list is ranked). */
export function nextForReview(active: readonly DashboardThread[]): DashboardThread | null {
  return active.find((entry) => NEEDS_YOU.has(entry.status?.label ?? "")) ?? null;
}

export function pulseSentence(pulse: { readonly working: number; readonly needsYou: number }) {
  const parts: string[] = [];
  if (pulse.needsYou > 0) {
    parts.push(`${pulse.needsYou} ${pulse.needsYou === 1 ? "thread needs" : "threads need"} you`);
  }
  if (pulse.working > 0) {
    parts.push(`${pulse.working} ${pulse.working === 1 ? "thread is" : "threads are"} working`);
  }
  return parts.length === 0 ? "All quiet. Start something new below." : `${parts.join(", ")}.`;
}

/**
 * The dashboard's welcome (Polaris): Orbie, a greeting for the time of day and
 * one live line about what is going on, announced politely as it changes.
 * When a thread waits on you, "Review next" opens it: the dashboard doubles as
 * the review queue.
 */
export function DashboardGreeting({
  active,
  now,
}: {
  readonly active: readonly DashboardThread[];
  readonly now?: Date;
}) {
  const pulse = dashboardPulse(active);
  const next = nextForReview(active);
  return (
    <div className="flex items-center gap-3.5 pb-1">
      <OrbieAvatar
        size={44}
        live
        state={pulse.working > 0 ? "working" : "default"}
        label={ORBIE_NAME}
      />
      <div className="min-w-0">
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {greetingFor((now ?? new Date()).getHours())}
        </p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pulseSentence(pulse)}
        </p>
      </div>
      {next === null ? null : (
        <Button
          size="sm"
          className="ms-auto"
          render={
            <Link
              to="/$environmentId/$threadId"
              params={{ environmentId: next.thread.environmentId, threadId: next.thread.id }}
            />
          }
        >
          Review next
          <span className="sr-only">: {next.thread.title || "Untitled"}</span>
        </Button>
      )}
    </div>
  );
}
