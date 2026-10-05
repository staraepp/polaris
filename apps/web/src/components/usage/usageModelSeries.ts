import type { UsageProviderKind } from "@t3tools/contracts";
import type { DailyTotals } from "@t3tools/shared/usageMerge";

export type ModelTrendMetric = "cost" | "tokens";

export interface ModelTrendSeries {
  readonly key: string;
  readonly provider: UsageProviderKind;
  readonly model: string;
  readonly total: number;
  /** Rank among the shown models of the same provider; drives the shade. */
  readonly shade: number;
}

export interface ModelTrendColumn {
  readonly start: string;
  readonly end: string;
  /** Aligned with `series`. */
  readonly values: readonly number[];
  readonly other: number;
  readonly total: number;
}

export interface ModelTrend {
  readonly series: readonly ModelTrendSeries[];
  readonly columns: readonly ModelTrendColumn[];
  readonly otherTotal: number;
  readonly peak: number;
  /** 1 for daily columns, 7 for weekly ones. */
  readonly columnDays: number;
}

export const MODEL_TREND_TOP = 5;

/** Daily columns up to about six weeks, weekly beyond, so bars stay readable. */
export function columnDaysFor(dayCount: number): number {
  return dayCount <= 45 ? 1 : 7;
}

export function buildModelTrend(input: {
  readonly days: readonly string[];
  readonly daily: readonly DailyTotals[];
  readonly metric: ModelTrendMetric;
  readonly top?: number;
}): ModelTrend {
  const top = input.top ?? MODEL_TREND_TOP;
  const valueOf = (entry: { costUsd: number; totalTokens: number }) =>
    input.metric === "cost" ? entry.costUsd : entry.totalTokens;
  const byDay = new Map(input.daily.map((entry) => [entry.day, entry] as const));

  const totals = new Map<string, { provider: UsageProviderKind; model: string; total: number }>();
  for (const day of input.days) {
    for (const [key, entry] of byDay.get(day)?.byModel ?? []) {
      const current = totals.get(key) ?? { provider: entry.provider, model: entry.model, total: 0 };
      current.total += valueOf(entry);
      totals.set(key, current);
    }
  }
  const ranked = [...totals.entries()]
    .filter(([, entry]) => entry.total > 0)
    .toSorted((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  const shown = ranked.slice(0, top);
  const providerRank = new Map<UsageProviderKind, number>();
  const series: ModelTrendSeries[] = shown.map(([key, entry]) => {
    const shade = providerRank.get(entry.provider) ?? 0;
    providerRank.set(entry.provider, shade + 1);
    return { key, provider: entry.provider, model: entry.model, total: entry.total, shade };
  });
  const otherTotal = ranked.slice(top).reduce((sum, [, entry]) => sum + entry.total, 0);

  const columnDays = columnDaysFor(input.days.length);
  const columns: ModelTrendColumn[] = [];
  for (let index = 0; index < input.days.length; index += columnDays) {
    const chunk = input.days.slice(index, index + columnDays);
    const values = series.map(() => 0);
    let other = 0;
    for (const day of chunk) {
      for (const [key, entry] of byDay.get(day)?.byModel ?? []) {
        const at = series.findIndex((item) => item.key === key);
        if (at >= 0) values[at] = (values[at] ?? 0) + valueOf(entry);
        else other += valueOf(entry);
      }
    }
    const total = values.reduce((sum, value) => sum + value, other);
    columns.push({
      start: chunk[0] ?? "",
      end: chunk.at(-1) ?? "",
      values,
      other,
      total,
    });
  }
  const peak = columns.reduce((max, column) => Math.max(max, column.total), 0);
  return { series, columns, otherTotal, peak, columnDays };
}

/** Three gridlines on round numbers, so the axis reads like a ruler. */
export function niceTicks(peak: number, count = 3): readonly number[] {
  if (peak <= 0) return [];
  const raw = peak / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].reduce((best, candidate) =>
    Math.abs(candidate * magnitude - raw) < Math.abs(best * magnitude - raw) ? candidate : best,
  );
  const step = factor * magnitude;
  return Array.from({ length: count }, (_, index) => step * (index + 1)).filter(
    (tick) => tick <= peak * 1.2,
  );
}
