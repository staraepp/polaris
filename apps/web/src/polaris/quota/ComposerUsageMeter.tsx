import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { composerFloatingLayerProps } from "~/components/chat/composerEventScope";
import { LimitWindows } from "~/components/usage/UsageLimits";

import type { ThreadUsage } from "../threadUsage/threadUsage";
import { ThreadUsageSection } from "../threadUsage/ThreadUsageSection";
import type { UsageMeterModel } from "./usageMeterModel";

const TRACK_X = 2;
const TRACK_WIDTH = 16;

/**
 * Quota gauge beside the send button (Polaris): one thin bar per window,
 * filled by what is left. Neutral until a window drops to the quota-low
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
  const rows = model.bars.length === 1 ? [10] : [7, 13];
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
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              {model.bars.map((bar, index) => {
                const y = rows[index] ?? 10;
                const fill = (TRACK_WIDTH * Math.max(0, Math.min(100, bar.remainingPercent))) / 100;
                return (
                  <g key={bar.id}>
                    <rect
                      x={TRACK_X}
                      y={y - 1.5}
                      width={TRACK_WIDTH}
                      height={3}
                      rx={1.5}
                      className="fill-muted-foreground/24"
                    />
                    {fill > 0 ? (
                      <rect
                        x={TRACK_X}
                        y={y - 1.5}
                        width={Math.max(3, fill)}
                        height={3}
                        rx={1.5}
                        data-low={bar.low}
                        className="fill-muted-foreground/72 transition-[width] duration-500 ease-out motion-reduce:transition-none data-[low=true]:fill-warning"
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
