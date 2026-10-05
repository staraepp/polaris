import type { DailyTotals } from "@t3tools/shared/usageMerge";
import { formatDayShort, formatTokens, formatUsd } from "@t3tools/shared/usageFormat";
import { useMemo, useState } from "react";

import { PROVIDER_PRESENTATION } from "./usageProviders";
import {
  buildModelTrend,
  niceTicks,
  type ModelTrendColumn,
  type ModelTrendMetric,
  type ModelTrendSeries,
} from "./usageModelSeries";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 180;
const PLOT_TOP = 6;
const SHADE_MIX = [100, 66, 44, 30, 22] as const;
const OTHER_COLOR = "color-mix(in oklab, var(--muted-foreground) 28%, var(--background))";

/** Models of one provider share its hue and step down in strength, so no new palette is needed. */
export function seriesColor(series: Pick<ModelTrendSeries, "provider" | "shade">): string {
  const base = PROVIDER_PRESENTATION[series.provider].color;
  const mix = SHADE_MIX[Math.min(series.shade, SHADE_MIX.length - 1)] ?? 22;
  return mix === 100 ? base : `color-mix(in oklab, ${base} ${mix}%, var(--background))`;
}

function format(metric: ModelTrendMetric, value: number): string {
  return metric === "cost" ? formatUsd(value) : formatTokens(value);
}

function columnLabel(column: ModelTrendColumn, columnDays: number): string {
  return columnDays === 1 || column.start === column.end
    ? formatDayShort(column.start)
    : `${formatDayShort(column.start)} – ${formatDayShort(column.end)}`;
}

export function UsageModelTrend({
  days,
  daily,
  metric,
}: {
  readonly days: readonly string[];
  readonly daily: readonly DailyTotals[];
  readonly metric: ModelTrendMetric;
}) {
  const trend = useMemo(() => buildModelTrend({ days, daily, metric }), [days, daily, metric]);
  const [active, setActive] = useState<number | null>(null);
  const ticks = useMemo(() => niceTicks(trend.peak), [trend.peak]);
  if (trend.series.length === 0) return null;

  const scaleMax = Math.max(trend.peak, ticks.at(-1) ?? 0);
  const plotHeight = VIEW_HEIGHT - PLOT_TOP;
  const slot = VIEW_WIDTH / trend.columns.length;
  const barWidth = Math.max(2, Math.min(28, slot * 0.68));
  const y = (value: number) => VIEW_HEIGHT - (value / scaleMax) * plotHeight;
  const activeColumn = active === null ? null : (trend.columns[active] ?? null);
  const unit = trend.columnDays === 1 ? "day" : "week";

  return (
    <section className="flex flex-col gap-3" aria-labelledby="usage-model-trend-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="usage-model-trend-heading" className="text-sm font-medium text-foreground">
          Models over time
        </h2>
        <span className="text-xs text-muted-foreground">
          {metric === "cost" ? "Cost" : "Tokens"} per {unit}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${metric === "cost" ? "Cost" : "Tokens"} per ${unit} by model. Top model: ${trend.series[0]?.model ?? "none"}, ${format(metric, trend.series[0]?.total ?? 0)}.`}
          tabIndex={0}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            const last = trend.columns.length - 1;
            const next =
              event.key === "ArrowRight"
                ? Math.min(last, (active ?? -1) + 1)
                : event.key === "ArrowLeft"
                  ? Math.max(0, (active ?? last + 1) - 1)
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? last
                      : null;
            if (next === null) return;
            event.preventDefault();
            setActive(next);
          }}
          className="h-44 w-full overflow-visible rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={VIEW_WIDTH}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={0}
            x2={VIEW_WIDTH}
            y1={VIEW_HEIGHT}
            y2={VIEW_HEIGHT}
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
          />
          {trend.columns.map((column, index) => {
            const x = index * slot + (slot - barWidth) / 2;
            let cursor = VIEW_HEIGHT;
            const segments = [
              ...trend.series.map((series, at) => ({
                key: series.key,
                value: column.values[at] ?? 0,
                color: seriesColor(series),
              })),
              { key: "other", value: column.other, color: OTHER_COLOR },
            ].filter((segment) => segment.value > 0);
            return (
              <g
                key={column.start}
                onPointerEnter={() => setActive(index)}
                onClick={() => setActive(index)}
                opacity={active === null || active === index ? 1 : 0.45}
                className="transition-opacity duration-150 motion-reduce:transition-none"
              >
                <rect x={index * slot} y={0} width={slot} height={VIEW_HEIGHT} fill="transparent" />
                {segments.map((segment) => {
                  const height = (segment.value / scaleMax) * plotHeight;
                  cursor -= height;
                  return (
                    <rect
                      key={segment.key}
                      x={x}
                      y={cursor}
                      width={barWidth}
                      height={Math.max(0, height - 1)}
                      rx={Math.min(3, barWidth / 4)}
                      style={{ fill: segment.color }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex flex-col">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-full pb-0.5 text-2xs text-muted-foreground tabular-nums"
              style={{ top: `${(y(tick) / VIEW_HEIGHT) * 100}%` }}
            >
              {format(metric, tick)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-2xs text-muted-foreground tabular-nums" aria-hidden>
        <span>{formatDayShort(trend.columns[0]?.start ?? "")}</span>
        <span>{formatDayShort(trend.columns.at(-1)?.end ?? "")}</span>
      </div>

      <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
        {activeColumn === null ? (
          `Hover, tap or use the arrow keys to read a ${unit}.`
        ) : (
          <>
            <span className="text-foreground">{columnLabel(activeColumn, trend.columnDays)}</span>
            {" · "}
            {format(metric, activeColumn.total)}
            {trend.series
              .map((series, at) => ({ series, value: activeColumn.values[at] ?? 0 }))
              .filter((entry) => entry.value > 0)
              .map((entry) => ` · ${entry.series.model} ${format(metric, entry.value)}`)
              .join("")}
            {activeColumn.other > 0 ? ` · other ${format(metric, activeColumn.other)}` : ""}
          </>
        )}
      </p>

      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {trend.series.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-xs"
              style={{ backgroundColor: seriesColor(series) }}
            />
            <span className="text-foreground">{series.model}</span>
            <span className="text-muted-foreground tabular-nums">
              {format(metric, series.total)}
            </span>
          </li>
        ))}
        {trend.otherTotal > 0 ? (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-xs"
              style={{ backgroundColor: OTHER_COLOR }}
            />
            <span className="text-foreground">Other models</span>
            <span className="text-muted-foreground tabular-nums">
              {format(metric, trend.otherTotal)}
            </span>
          </li>
        ) : null}
      </ul>

      <table className="sr-only">
        <caption>Usage by model per {unit}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {trend.series.map((series) => (
              <th key={series.key} scope="col">
                {series.model}
              </th>
            ))}
            <th scope="col">Other</th>
          </tr>
        </thead>
        <tbody>
          {trend.columns
            .filter((column) => column.total > 0)
            .map((column) => (
              <tr key={column.start}>
                <th scope="row">{columnLabel(column, trend.columnDays)}</th>
                {column.values.map((value, at) => (
                  <td key={trend.series[at]?.key}>{format(metric, value)}</td>
                ))}
                <td>{format(metric, column.other)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}
