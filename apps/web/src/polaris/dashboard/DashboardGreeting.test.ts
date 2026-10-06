import { describe, expect, it } from "vite-plus/test";

import { dashboardPulse, greetingFor, nextForReview, pulseSentence } from "./DashboardGreeting";
import type { DashboardThread } from "./dashboardThreads";

const entry = (label: string | null) =>
  ({
    thread: {},
    status: label === null ? null : { label, colorClass: "", dotClass: "", pulse: false },
  }) as unknown as DashboardThread;

describe("dashboard greeting", () => {
  it("greets by the hour", () => {
    expect(greetingFor(2)).toBe("Up late");
    expect(greetingFor(9)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(21)).toBe("Good evening");
  });

  it("counts busy threads and threads that need the user", () => {
    const pulse = dashboardPulse([
      entry("Working"),
      entry("Connecting"),
      entry("Pending Approval"),
      entry("Completed"),
      entry(null),
    ]);
    expect(pulse).toEqual({ working: 2, needsYou: 1 });
    expect(pulseSentence(pulse)).toBe("1 thread needs you, 2 threads are working.");
    expect(pulseSentence({ working: 0, needsYou: 0 })).toBe(
      "All quiet. Start something new below.",
    );
  });

  it("picks the first thread waiting on the user for Review next", () => {
    const waiting = entry("Awaiting Input");
    expect(nextForReview([entry("Working"), waiting, entry("Plan Ready")])).toBe(waiting);
    expect(nextForReview([entry("Working"), entry(null)])).toBeNull();
  });
});
