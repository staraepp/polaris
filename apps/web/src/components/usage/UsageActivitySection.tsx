import type { EnvironmentId } from "@t3tools/contracts";
import { makeWindow } from "@t3tools/shared/usageFormat";
import { useEffect, useEffectEvent, useState } from "react";

import { useUsage } from "../../state/usage";
import { Skeleton } from "../ui/skeleton";
import { UsageActivityHeatmap } from "./UsageActivityHeatmap";
import type { HeatmapMetric } from "./usageHeatmap";

export const ACTIVITY_WINDOW_DAYS = 365;

/**
 * The year-long activity view. It asks for its own 365-day window, separate from the page's
 * period picker, so changing the period never changes the grid. `refreshToken` ticks when the
 * page's refresh button is pressed.
 */
export function UsageActivitySection({
  metric,
  selectedEnvironmentIds,
  refreshToken,
}: {
  readonly metric: HeatmapMetric;
  readonly selectedEnvironmentIds: ReadonlySet<EnvironmentId> | null;
  readonly refreshToken: number;
}) {
  const [window, setWindow] = useState(() => makeWindow(ACTIVITY_WINDOW_DAYS));
  const { merged, isPending, refresh } = useUsage(window, selectedEnvironmentIds);
  const refreshYear = useEffectEvent(() => {
    const next = makeWindow(ACTIVITY_WINDOW_DAYS);
    setWindow(next);
    void refresh(next);
  });
  useEffect(() => {
    if (refreshToken > 0) refreshYear();
  }, [refreshToken]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="usage-activity-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="usage-activity-heading" className="text-sm font-medium text-foreground">
          Activity
        </h2>
        <span className="text-xs text-muted-foreground">Last {ACTIVITY_WINDOW_DAYS} days</span>
      </div>
      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <UsageActivityHeatmap
          daily={merged.daily}
          sinceDay={window.sinceDay}
          untilDay={window.untilDay}
          metric={metric}
        />
      )}
    </section>
  );
}
