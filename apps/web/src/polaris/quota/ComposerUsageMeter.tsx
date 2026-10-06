import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { composerFloatingLayerProps } from "~/components/chat/composerEventScope";
import { LimitWindows } from "~/components/usage/UsageLimits";

import type { ThreadUsage } from "../threadUsage/threadUsage";
import { ThreadUsageSection } from "../threadUsage/ThreadUsageSection";
import type { UsageMeterModel } from "./usageMeterModel";

/** Ring radii, outside in: the first window (usually 5 hours) rings the second. */
const RING_RADII = [7.25, 3.75] as const;
const RING_STROKE = 2;

/**
 * Quota gauge beside the send button (Polaris): one ring per window, the
 * first outside, each drawn around by what is left. Neutral until a window drops to the quota-low
 * threshold, then that bar turns amber, the same signal as the outline.
 */
export function ComposerUsageMeter({
  model,
  threadUsage,
}: {
  readonly model: UsageMeterModel;
  readonly threadUsage?: ThreadUsage | null | undefined;
}) {
  // Reset countdowns are read when the popover opens, not on every render.
  const [now, setNow] = useState(() => Date.now());
  const radii: readonly number[] = model.bars.length === 1 ? [6] : RING_RADII;
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setNow(Date.now());
      }}
    >
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={150}
        render={
          <Button
            size="icon-sm"
            variant="ghost-muted"
            className="size-7"
            data-low={model.low}
            aria-label={`Usage limits: ${model.tightest.label} ${model.tightest.remainingPercent}% left`}
          >
            <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden="true">
              {model.bars.map((bar, index) => {
                const radius = radii[index] ?? 7;
                const left = Math.max(0, Math.min(100, bar.remainingPercent));
                return (
                  <g key={bar.id}>
                    <circle
                      cx="10"
                      cy="10"
                      r={radius}
                      fill="none"
                      strokeWidth={RING_STROKE}
                      className="stroke-muted-foreground/20"
                    />
                    {left > 0 ? (
                      <circle
                        cx="10"
                        cy="10"
                        r={radius}
                        fill="none"
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray={`${left} 100`}
                        data-low={bar.low}
                        className="stroke-muted-foreground/72 transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none data-[low=true]:stroke-warning"
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </Button>
        }
      />
      <PopoverPopup
        {...composerFloatingLayerProps}
        tooltipStyle
        side="top"
        align="end"
        padding="none"
        width="md"
        className="text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 p-(--floating-content-inset)">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-muted-foreground text-xs">Usage limits</div>
            <Link
              to="/usage"
              className="text-2xs text-secondary-label underline-offset-2 hover:text-foreground hover:underline"
            >
              Open Usage
            </Link>
          </div>
          <LimitWindows compact driver={model.driver} windows={model.windows} now={now} />
          {model.low ? (
            <div className="text-pretty text-2xs font-medium text-warning-foreground">
              {model.tightest.label} is at {model.tightest.remainingPercent}% left, at or below your{" "}
              {model.thresholdPercent}% warning.
            </div>
          ) : null}
          {threadUsage ? <ThreadUsageSection usage={threadUsage} /> : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
