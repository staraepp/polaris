import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { describe, expect, it } from "vite-plus/test";

import { needsLeadSlot, selectDashboardThreads } from "./dashboardThreads";

const thread = (id: string, updatedAt: string, extra: Partial<EnvironmentThreadShell> = {}) =>
  ({
    id,
    updatedAt,
    archivedAt: null,
    deletedAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    latestRun: null,
    runtime: null,
    pendingBackgroundTasks: [],
    lastVisitedAt: updatedAt,
    ...extra,
  }) as unknown as EnvironmentThreadShell;

describe("selectDashboardThreads", () => {
  it("puts threads that need the user first, then the most recent of the rest", () => {
    const threads = [
      thread("old", "2026-10-01T00:00:00.000Z"),
      thread("working", "2026-10-04T00:00:00.000Z", {
        runtime: { status: "running" } as EnvironmentThreadShell["runtime"],
      }),
      thread("approval", "2026-10-02T00:00:00.000Z", { hasPendingApprovals: true }),
      thread("new", "2026-10-05T00:00:00.000Z"),
      thread("gone", "2026-10-05T01:00:00.000Z", { archivedAt: "2026-10-05T02:00:00.000Z" }),
    ];
    const { active, recent } = selectDashboardThreads(threads, { active: 5, recent: 1 });
    expect(active.map((entry) => entry.thread.id)).toEqual(["approval", "working"]);
    expect(active[0]?.status?.label).toBe("Pending Approval");
    expect(recent.map((entry) => entry.thread.id)).toEqual(["new"]);
  });
});

describe("needsLeadSlot", () => {
  const threads = [
    thread("a", "2026-10-05T00:00:00.000Z"),
    thread("b", "2026-10-04T00:00:00.000Z", { hasPendingApprovals: true }),
  ];
  const { active, recent } = selectDashboardThreads(threads, { active: 5, recent: 5 });

  it("drops the slot when no row has a status or an icon", () => {
    expect(needsLeadSlot(recent, () => false)).toBe(false);
  });

  it("keeps it for a status or a chat icon", () => {
    expect(needsLeadSlot([...active, ...recent], () => false)).toBe(true);
    expect(needsLeadSlot(recent, (entry) => entry.thread.id === "a")).toBe(true);
  });
});
