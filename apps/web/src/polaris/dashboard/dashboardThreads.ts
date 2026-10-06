import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import { resolveThreadStatusPill, type ThreadStatusPill } from "~/components/Sidebar.logic";

export interface DashboardThread {
  readonly thread: EnvironmentThreadShell;
  readonly status: ThreadStatusPill | null;
}

/** Statuses that want the user, ahead of ones that are only busy. */
const ATTENTION_RANK: Record<string, number> = {
  "Pending Approval": 0,
  "Awaiting Input": 1,
  "Plan Ready": 2,
  Working: 3,
  Connecting: 3,
  Waiting: 4,
  Completed: 5,
};

const rankOf = (entry: DashboardThread) =>
  entry.status === null ? 9 : (ATTENTION_RANK[entry.status.label] ?? 9);

const isLive = (thread: EnvironmentThreadShell) =>
  thread.archivedAt === null && thread.deletedAt === null;

/**
 * The dashboard's thread lists (Polaris): threads with a status, the ones
 * that need the user first, then the most recently updated of the rest.
 */
export function selectDashboardThreads(
  threads: readonly EnvironmentThreadShell[],
  limits: { readonly active: number; readonly recent: number },
): { readonly active: readonly DashboardThread[]; readonly recent: readonly DashboardThread[] } {
  const live = threads.filter(isLive).map((thread) => ({
    thread,
    status: resolveThreadStatusPill({ thread }),
  }));
  const byUpdated = (left: DashboardThread, right: DashboardThread) =>
    right.thread.updatedAt.localeCompare(left.thread.updatedAt);
  const active = live
    .filter((entry) => entry.status !== null)
    .toSorted((left, right) => rankOf(left) - rankOf(right) || byUpdated(left, right))
    .slice(0, limits.active);
  const shown = new Set(active.map((entry) => entry.thread));
  const recent = live
    .filter((entry) => !shown.has(entry.thread))
    .toSorted(byUpdated)
    .slice(0, limits.recent);
  return { active, recent };
}

/**
 * Whether thread rows get a leading slot: only when some row has a status dot
 * or a chat icon to put there, so plain lists line up with their headings.
 */
export function needsLeadSlot(
  entries: readonly DashboardThread[],
  hasIcon: (entry: DashboardThread) => boolean,
): boolean {
  return entries.some((entry) => entry.status !== null || hasIcon(entry));
}
