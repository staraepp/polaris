import { formatDayShort, formatTokens, formatUsd } from "@t3tools/shared/usageFormat";

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

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
          {pending ? "–" : format(total)}
        </span>
        <span className="text-xs text-muted-foreground">
          {byCost ? "spent" : "tokens"} over {days.length} days
        </span>
      </div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="mt-auto h-[72px] w-full"
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
              className={share > 0 ? "fill-primary/70" : "fill-border"}
            />
          );
        })}
      </svg>
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
