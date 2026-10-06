import { Schema } from "effect";

/** The dashboard's tiles (Polaris), in the default order. */
export const DASHBOARD_TILE_IDS = [
  "start",
  "threads",
  "usage",
  "pullRequests",
  "activity",
] as const;
export type DashboardTileId = (typeof DASHBOARD_TILE_IDS)[number];

export const DashboardTileOrder = Schema.Array(Schema.String);

export const DASHBOARD_LAYOUT_STORAGE_KEY = "polaris:dashboard-layout:v1";

/**
 * Grid footprint on the six-column bento at `lg` and up; every tile is full
 * width below that. Two shapes, both filling every row in the default order:
 * with a long thread list the threads tile runs two rows beside Start and
 * Today, and pull requests share the last row with activity; with a short
 * one it stays one row, pull requests widen, and activity spans the bottom.
 * A reorder moves tiles without reshaping them; `grid-flow-dense` back-fills.
 */
const TILE_SPAN: Record<"tall" | "short", Record<DashboardTileId, string>> = {
  tall: {
    start: "lg:col-span-2",
    threads: "lg:col-span-4 lg:row-span-2",
    usage: "lg:col-span-2",
    pullRequests: "lg:col-span-3",
    activity: "lg:col-span-3",
  },
  short: {
    start: "lg:col-span-2",
    threads: "lg:col-span-4",
    usage: "lg:col-span-2",
    pullRequests: "lg:col-span-4",
    activity: "lg:col-span-6",
  },
};

/** Thread rows from which the threads tile takes the tall shape. */
export const THREADS_TALL_FROM_ROWS = 5;

export function threadsTileIsTall(threadRows: number): boolean {
  return threadRows >= THREADS_TALL_FROM_ROWS;
}

export function dashboardTileSpan(id: DashboardTileId, threadRows: number): string {
  return TILE_SPAN[threadsTileIsTall(threadRows) ? "tall" : "short"][id];
}

const isTileId = (value: string): value is DashboardTileId =>
  (DASHBOARD_TILE_IDS as readonly string[]).includes(value);

/**
 * A stored order made safe to render: unknown and repeated ids dropped, and
 * tiles added since it was saved appended in their default place.
 */
export function normalizeTileOrder(stored: readonly string[]): readonly DashboardTileId[] {
  const seen = new Set<DashboardTileId>();
  for (const id of stored) if (isTileId(id)) seen.add(id);
  for (const id of DASHBOARD_TILE_IDS) seen.add(id);
  return [...seen];
}

/** The order with `id` moved to `toIndex` (clamped). */
export function moveTile(
  order: readonly DashboardTileId[],
  id: DashboardTileId,
  toIndex: number,
): readonly DashboardTileId[] {
  const from = order.indexOf(id);
  if (from === -1) return order;
  const rest = order.filter((tile) => tile !== id);
  const at = Math.max(0, Math.min(rest.length, toIndex));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

export function isDefaultTileOrder(order: readonly DashboardTileId[]): boolean {
  return order.every((id, index) => DASHBOARD_TILE_IDS[index] === id);
}
