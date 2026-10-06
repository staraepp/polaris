import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { composerFloatingLayerProps } from "~/components/chat/composerEventScope";
import { LimitWindows } from "~/components/usage/UsageLimits";

import type { ThreadUsage } from "../threadUsage/threadUsage";
import { ThreadUsageSection } from "../threadUsage/ThreadUsageSection";
import { readDevFxOverride } from "../fx/devFxOverride";
import type { UsageMeterModel } from "./usageMeterModel";

/** Dev builds only: the forced quota-low state for screenshots (see devFxOverride.ts). */
function withDevOverride(model: UsageMeterModel): UsageMeterModel {
  if (readDevFxOverride()?.quotaLow !== true) return model;
  const tightest = { ...model.tightest, low: true };
  return {
    ...model,
    low: true,
    tightest,
    bars: model.bars.map((bar) => (bar.id === tightest.id ? { ...bar, low: true } : bar)),
  };
}

/** Ring radii, outside in: the first window (usually 5 hours) rings the second. */
const RING_RADII = [7.25, 3.75] as const;
const RING_STROKE = 2;

/** A small dial with its needle at the low end: the quota-low badge's icon. */
function QuotaLowGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0" aria-hidden="true">
      <path
        d="M2.75 11.25a5.25 5.25 0 0 1 10.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M8 11.25 4.6 8.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r="1.25" fill="currentColor" />
    </svg>
  );
}

/**
 * Quota gauge beside the send button (Polaris): one ring per window, the
 * first outside, each drawn around by what is left. The rings stay neutral;
 * once a window drops to the quota-low threshold (after the outline's red
 * flash) a red-coral badge with the remaining share sits beside them.
 */
export function ComposerUsageMeter({
  model: reportedModel,
  threadUsage,
}: {
  readonly model: UsageMeterModel;
  readonly threadUsage?: ThreadUsage | null | undefined;
}) {
  const model = withDevOverride(reportedModel);
  // Reset countdowns are read when the popover opens, not on every render.
  const [now, setNow] = useState(() => Date.now());
  const radii: readonly number[] = model.bars.length === 1 ? [6] : RING_RADII;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {model.low ? (
        <span
          aria-hidden="true"
          data-polaris-quota-low-badge
          className="inline-flex h-5 items-center gap-1 rounded-full bg-quota-low-surface px-1.5 text-2xs font-medium text-quota-low tabular-nums ring-1 ring-quota-low/25 ring-inset"
        >
          <QuotaLowGlyph />
          {model.tightest.remainingPercent}%
        </span>
      ) : null}
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
              aria-label={`Usage limits: ${model.tightest.label} ${model.tightest.remainingPercent}% left${model.low ? ", low" : ""}`}
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
                          className="stroke-muted-foreground/72 transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none"
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
              <div className="text-pretty text-2xs font-medium text-quota-low">
                {model.tightest.label} is at {model.tightest.remainingPercent}% left, at or below
                your {model.thresholdPercent}% warning.
              </div>
            ) : null}
            {threadUsage ? <ThreadUsageSection usage={threadUsage} /> : null}
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  );
}
