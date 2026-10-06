import { formatDayShort, formatTokens, formatUsd } from "@t3tools/shared/usageFormat";
import { type KeyboardEvent, type PointerEvent, useState } from "react";

import { cn } from "~/lib/utils";

/** One column per day, filled from what each day cost (or used, without prices). */
export interface ActivityDay {
  readonly day: string;
  readonly costUsd: number;
  readonly totalTokens: number;
}

const CHART_HEIGHT = 72;

/** Two weeks of spend as quiet bars, newest on the right (Polaris dashboard). */
export function ActivityTileBody({
  days,
  pending,
}: {
  readonly days: readonly ActivityDay[];
  readonly pending: boolean;
}) {
  const byCost = days.some((day) => day.costUsd > 0);
  const value = (day: ActivityDay) => (byCost ? day.costUsd : day.totalTokens);
  const peak = Math.max(0, ...days.map(value));
  const total = days.reduce((sum, day) => sum + value(day), 0);
  const format = (amount: number) => (byCost ? formatUsd(amount) : formatTokens(amount));
  const first = days[0];
  const last = days.at(-1);
  const gap = 4;
  const barWidth = days.length > 0 ? (100 - gap * (days.length - 1) * 0.25) / days.length : 0;
  // The day under the pointer or keyboard; the header reads it out.
  const [active, setActive] = useState<number | null>(null);
  const activeDay = active === null ? undefined : days[active];
  const unit = byCost ? "spent" : "tokens";
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(days.length - 1, Math.floor(share * days.length))));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = days.length - 1;
    const current = active ?? lastIndex;
    const next =
      event.key === "ArrowLeft"
        ? current - 1
        : event.key === "ArrowRight"
          ? current + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(Math.max(0, Math.min(lastIndex, next)));
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-baseline gap-3" aria-live="polite">
        <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
          {pending ? "–" : format(activeDay ? value(activeDay) : total)}
        </span>
        <span className="text-xs text-muted-foreground">
          {activeDay
            ? `${unit} on ${formatDayShort(activeDay.day)}`
            : `${unit} over ${days.length} days`}
        </span>
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label={`Daily ${byCost ? "spend" : "tokens"}. Use the arrow keys to read each day.`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="mt-auto cursor-crosshair rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          viewBox={`0 0 100 ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block h-[72px] w-full"
        >
          {days.map((day, index) => {
            const share = peak > 0 ? value(day) / peak : 0;
            const height = Math.max(share * CHART_HEIGHT, 1.5);
            return (
              <rect
                key={day.day}
                x={index * (barWidth + gap * 0.25)}
                y={CHART_HEIGHT - height}
                width={barWidth}
                height={height}
                rx={0.8}
                className={cn(
                  "transition-opacity duration-150 motion-reduce:transition-none",
                  share > 0
                    ? index === active
                      ? "fill-primary"
                      : "fill-primary/70"
                    : "fill-border",
                  active !== null && index !== active && "opacity-50",
                )}
              />
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between text-2xs text-muted-foreground tabular-nums">
        <span>{first ? formatDayShort(first.day) : ""}</span>
        <span>{last ? formatDayShort(last.day) : ""}</span>
      </div>
      <table className="sr-only">
        <caption>Daily {byCost ? "spend" : "tokens"}</caption>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{formatDayShort(day.day)}</th>
              <td>{format(value(day))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
