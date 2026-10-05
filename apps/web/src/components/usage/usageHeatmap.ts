import { enumerateDays } from "@t3tools/shared/usageFormat";
import type { DailyTotals } from "@t3tools/shared/usageMerge";

export type HeatmapMetric = "cost" | "tokens";
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapCell {
  readonly day: string;
  readonly costUsd: number;
  readonly totalTokens: number;
  /** The selected metric's value, which also drives `level`. */
  readonly value: number;
  readonly level: HeatmapLevel;
}

export interface HeatmapModel {
  /** One entry per calendar week, Sunday first. `null` pads days outside the window. */
  readonly weeks: readonly (readonly (HeatmapCell | null)[])[];
  readonly monthLabels: readonly { readonly weekIndex: number; readonly label: string }[];
  readonly total: number;
  readonly activeDays: number;
  readonly totalDays: number;
  readonly longestStreak: number;
  readonly currentStreak: number;
  readonly busiest: HeatmapCell | null;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/**
 * Buckets positive values into four levels by their rank among the active days.
 * Usage is heavy-tailed, so a linear scale would paint almost every day the
 * lightest shade; ranking keeps each level populated. Ties share a mid-rank.
 */
export function levelsForValues(values: readonly number[]): ReadonlyMap<number, HeatmapLevel> {
  const positive = values.filter((value) => value > 0).toSorted((a, b) => a - b);
  const levels = new Map<number, HeatmapLevel>();
  const count = positive.length;
  let index = 0;
  while (index < count) {
    const value = positive[index] as number;
    let end = index;
    while (end < count && positive[end] === value) end += 1;
    const midRank = (index + end) / 2 / count;
    levels.set(value, (1 + Math.min(3, Math.floor(midRank * 4))) as HeatmapLevel);
    index = end;
  }
  return levels;
}

export function buildHeatmap(input: {
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly daily: readonly DailyTotals[];
  readonly metric: HeatmapMetric;
}): HeatmapModel {
  const days = enumerateDays(input.sinceDay, input.untilDay);
  const byDay = new Map(input.daily.map((entry) => [entry.day, entry] as const));
  const valueOf = (day: string): number => {
    const entry = byDay.get(day);
    if (entry === undefined) return 0;
    return input.metric === "cost" ? entry.costUsd : entry.totalTokens;
  };
  const levels = levelsForValues(days.map(valueOf));

  const cells: HeatmapCell[] = days.map((day) => {
    const entry = byDay.get(day);
    const value = valueOf(day);
    return {
      day,
      costUsd: entry?.costUsd ?? 0,
      totalTokens: entry?.totalTokens ?? 0,
      value,
      level: value > 0 ? (levels.get(value) ?? 1) : 0,
    };
  });

  const weeks: (HeatmapCell | null)[][] = [];
  let week: (HeatmapCell | null)[] = [];
  const lead = cells.length === 0 ? 0 : weekdayOf((cells[0] as HeatmapCell).day);
  for (let pad = 0; pad < lead; pad += 1) week.push(null);
  for (const cell of cells) {
    week.push(cell);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthLabels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((entries, weekIndex) => {
    const first = entries.find((entry) => entry !== null);
    if (first === undefined || first === null) return;
    const month = Number(first.day.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      monthLabels.push({ weekIndex, label: MONTH_NAMES[month] ?? "" });
      lastMonth = month;
    }
  });
  // A label squeezed against the next one would overlap it.
  if (
    monthLabels.length > 1 &&
    (monthLabels[1]?.weekIndex ?? 0) - (monthLabels[0]?.weekIndex ?? 0) < 2
  ) {
    monthLabels.shift();
  }
  // A label in the last two columns would run past the grid's right edge.
  const lastLabel = monthLabels.at(-1);
  if (lastLabel !== undefined && lastLabel.weekIndex > weeks.length - 3) monthLabels.pop();

  let longestStreak = 0;
  let run = 0;
  for (const cell of cells) {
    run = cell.value > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }
  let currentStreak = 0;
  let cursor = cells.length - 1;
  // Today may simply not have started yet, so an empty last day does not end the streak.
  if (cursor >= 0 && (cells[cursor] as HeatmapCell).value === 0) cursor -= 1;
  while (cursor >= 0 && (cells[cursor] as HeatmapCell).value > 0) {
    currentStreak += 1;
    cursor -= 1;
  }

  let busiest: HeatmapCell | null = null;
  let total = 0;
  let activeDays = 0;
  for (const cell of cells) {
    total += cell.value;
    if (cell.value > 0) activeDays += 1;
    if (cell.value > 0 && (busiest === null || cell.value > busiest.value)) busiest = cell;
  }

  return {
    weeks,
    monthLabels,
    total,
    activeDays,
    totalDays: cells.length,
    longestStreak,
    currentStreak,
    busiest,
  };
}

export interface MonthProjection {
  readonly monthToDate: number;
  readonly projected: number;
  readonly daysElapsed: number;
  readonly daysInMonth: number;
}

/** Straight-line month-end estimate from this month's pace. Null until the pace means something. */
export function projectMonthCost(input: {
  readonly daily: readonly DailyTotals[];
  readonly today: string;
}): MonthProjection | null {
  const [year = 0, month = 1, dayOfMonth = 1] = input.today
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const prefix = input.today.slice(0, 7);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthToDate = input.daily
    .filter((entry) => entry.day.startsWith(prefix) && entry.day <= input.today)
    .reduce((sum, entry) => sum + entry.costUsd, 0);
  if (dayOfMonth < 3 || monthToDate <= 0) return null;
  return {
    monthToDate,
    projected: (monthToDate / dayOfMonth) * daysInMonth,
    daysElapsed: dayOfMonth,
    daysInMonth,
  };
}

export function formatDayLong(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
