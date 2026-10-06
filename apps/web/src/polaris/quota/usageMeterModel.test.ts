import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { usageMeterModelOf } from "./usageMeterModel";

const window = (id: string, usedPercent: number) => ({
  id,
  kind: id === "five_hour" ? ("session" as const) : ("weekly" as const),
  label: id === "five_hour" ? "5-hour" : "Weekly",
  usedPercent,
});

const provider = (usageLimits: ServerProvider["usageLimits"]) =>
  ({ driver: "claudeAgent", usageLimits }) as unknown as ServerProvider;

const limits = (windows: ReturnType<typeof window>[]) => ({
  checkedAt: "2026-10-05T10:00:00.000Z",
  windows,
});

describe("usageMeterModelOf", () => {
  it("draws the first two windows and names the tightest", () => {
    const model = usageMeterModelOf(
      provider(limits([window("five_hour", 30), window("weekly", 85), window("opus", 50)])),
      20,
    );
    expect(model?.bars.map((bar) => [bar.id, bar.remainingPercent])).toEqual([
      ["five_hour", 70],
      ["weekly", 15],
    ]);
    expect(model?.tightest.id).toBe("weekly");
    expect(model?.windows).toHaveLength(3);
    expect(model?.low).toBe(true);
    expect(model?.bars[1]?.low).toBe(true);
  });

  it("is never low when the warning is off", () => {
    const model = usageMeterModelOf(provider(limits([window("weekly", 95)])), 0);
    expect(model?.low).toBe(false);
  });

  it("hides without windows, when the probe failed or without a provider", () => {
    expect(usageMeterModelOf(null, 20)).toBeNull();
    expect(usageMeterModelOf(provider(undefined), 20)).toBeNull();
    expect(usageMeterModelOf(provider(limits([])), 20)).toBeNull();
    expect(
      usageMeterModelOf(
        provider({ ...limits([window("weekly", 10)]), unavailable: { reason: "probeFailed" } }),
        20,
      ),
    ).toBeNull();
  });
});
