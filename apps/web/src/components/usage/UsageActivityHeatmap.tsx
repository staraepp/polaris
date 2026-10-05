import type { DailyTotals } from "@t3tools/shared/usageMerge";
import { formatCount, formatDayShort, formatTokens, formatUsd } from "@t3tools/shared/usageFormat";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "../../lib/utils";
import {
  buildHeatmap,
  formatDayLong,
  projectMonthCost,
  type HeatmapCell,
  type HeatmapLevel,
  type HeatmapMetric,
} from "./usageHeatmap";

const WEEKDAY_LABELS: ReadonlyArray<string | null> = [null, "Mon", null, "Wed", null, "Fri", null];
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Levels come from the brand token, so the grid follows the accent in every theme.
const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "bg-muted/70",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};

const formatValue = (metric: HeatmapMetric, value: number): string =>
  metric === "cost" ? formatUsd(value) : `${formatTokens(value)} tokens`;

const pluralDays = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? "day" : "days"}`;

function describeCell(cell: HeatmapCell): string {
  if (cell.costUsd <= 0 && cell.totalTokens <= 0) return `${formatDayLong(cell.day)}: no usage`;
  return `${formatDayLong(cell.day)}: ${formatUsd(cell.costUsd)}, ${formatTokens(cell.totalTokens)} tokens`;
}

/**
 * A GitHub-style year of daily activity. It is a single tab stop: arrow keys move
 * between days (up and down by one day, left and right by one week), and a tap
 * or click shows the same readout a hover does.
 */
export function UsageActivityHeatmap({
  daily,
  sinceDay,
  untilDay,
  metric,
}: {
  readonly daily: readonly DailyTotals[];
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly metric: HeatmapMetric;
}) {
  const model = useMemo(
    () => buildHeatmap({ sinceDay, untilDay, daily, metric }),
    [sinceDay, untilDay, daily, metric],
  );
  const projection = useMemo(
    () => (metric === "cost" ? projectMonthCost({ daily, today: untilDay }) : null),
    [daily, metric, untilDay],
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const cells = useMemo(
    () => model.weeks.flat().filter((cell): cell is HeatmapCell => cell !== null),
    [model.weeks],
  );
  const cellByDay = useMemo(() => new Map(cells.map((cell) => [cell.day, cell] as const)), [cells]);
  const tabStopDay =
    selected !== null && cellByDay.has(selected)
      ? selected
      : (model.busiest?.day ?? cells.at(-1)?.day ?? null);
  const readoutCell = cellByDay.get(hovered ?? selected ?? "") ?? null;
  const columns = model.weeks.length;
  const rowTemplate = { gridTemplateColumns: `1.75rem repeat(${columns}, minmax(0, 1fr))` };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = (event.target as HTMLElement).dataset.day;
    if (current === undefined || cells.length === 0) return;
    const index = cells.findIndex((cell) => cell.day === current);
    const delta: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    let next = index;
    if (event.key in delta) next = index + (delta[event.key] as number);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = cells.length - 1;
    else return;
    event.preventDefault();
    const target = cells[Math.min(cells.length - 1, Math.max(0, next))];
    if (target === undefined) return;
    setSelected(target.day);
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${target.day}"]`)?.focus();
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-baseline gap-1.5">
          <dt>Active days</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {formatCount(model.activeDays)}/{formatCount(model.totalDays)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>Longest streak</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {pluralDays(model.longestStreak)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>Current streak</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {pluralDays(model.currentStreak)}
          </dd>
        </div>
        {model.busiest !== null ? (
          <div className="flex items-baseline gap-1.5">
            <dt>Busiest day</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatDayShort(model.busiest.day)} · {formatValue(metric, model.busiest.value)}
            </dd>
          </div>
        ) : null}
        {projection !== null ? (
          <div className="flex items-baseline gap-1.5" data-testid="usage-projection">
            <dt>This month</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {formatUsd(projection.monthToDate)} so far · on pace for{" "}
              {formatUsd(projection.projected)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[40rem] flex-col gap-[3px]">
          <div
            aria-hidden
            className="grid gap-[3px] text-2xs text-muted-foreground"
            style={rowTemplate}
          >
            <span />
            {model.monthLabels.map((entry) => (
              <span
                key={`${entry.weekIndex}-${entry.label}`}
                className="whitespace-nowrap"
                style={{ gridColumn: entry.weekIndex + 2, gridRow: 1 }}
              >
                {entry.label}
              </span>
            ))}
          </div>
          <div
            ref={gridRef}
            role="grid"
            aria-label={`Daily ${metric === "cost" ? "cost" : "token"} activity, ${formatDayShort(sinceDay)} to ${formatDayShort(untilDay)}`}
            className="flex flex-col gap-[3px]"
            onKeyDown={moveFocus}
          >
            {WEEKDAY_LABELS.map((label, weekday) => (
              <div
                key={WEEKDAY_NAMES[weekday]}
                role="row"
                aria-label={WEEKDAY_NAMES[weekday]}
                className="grid items-center gap-[3px]"
                style={rowTemplate}
              >
                <span aria-hidden className="text-2xs leading-none text-muted-foreground">
                  {label}
                </span>
                {model.weeks.map((week, weekIndex) => {
                  const cell = week[weekday] ?? null;
                  if (cell === null) {
                    return (
                      <span
                        key={`pad-${weekIndex}`}
                        role="gridcell"
                        aria-hidden
                        className="aspect-square"
                      />
                    );
                  }
                  return (
                    <div
                      key={cell.day}
                      role="gridcell"
                      tabIndex={cell.day === tabStopDay ? 0 : -1}
                      data-day={cell.day}
                      data-level={cell.level}
                      aria-label={describeCell(cell)}
                      aria-selected={cell.day === selected}
                      className={cn(
                        "aspect-square rounded-xs outline-offset-1 focus-visible:outline-2 focus-visible:outline-ring",
                        LEVEL_CLASS[cell.level],
                        cell.day === (hovered ?? selected) && "ring-1 ring-foreground/60",
                      )}
                      onMouseEnter={() => setHovered(cell.day)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setSelected(cell.day)}
                      onClick={() => setSelected(cell.day)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground" data-testid="usage-heatmap-readout">
          {readoutCell === null
            ? `${formatValue(metric, model.total)} over ${pluralDays(model.totalDays)}`
            : describeCell(readoutCell)}
        </span>
        <span aria-hidden className="flex items-center gap-1 text-2xs text-muted-foreground">
          Less
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={cn("size-2.5 rounded-xs", LEVEL_CLASS[level])} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
