import { Schema } from "effect";

/** The built-in widgets (Polaris), in the default order. */
export const DASHBOARD_TILE_IDS = [
  "start",
  "threads",
  "usage",
  "pullRequests",
  "activity",
] as const;
export type DashboardTileId = (typeof DASHBOARD_TILE_IDS)[number];

/** Widgets the user makes themselves, as many as they like. */
export const CUSTOM_WIDGET_KINDS = ["note", "links"] as const;
export type CustomWidgetKind = (typeof CUSTOM_WIDGET_KINDS)[number];

export type DashboardWidgetKind = DashboardTileId | CustomWidgetKind;

/** Width on the six-column bento at `lg` and up; every widget is full width below that. */
export const DASHBOARD_WIDGET_SIZES = ["small", "medium", "large", "full"] as const;
export type DashboardWidgetSize = (typeof DASHBOARD_WIDGET_SIZES)[number];

export const DASHBOARD_WIDGET_SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  full: "Full width",
};

const SIZE_SPAN: Record<DashboardWidgetSize, string> = {
  small: "lg:col-span-2",
  medium: "lg:col-span-3",
  large: "lg:col-span-4",
  full: "lg:col-span-6",
};

export interface DashboardLink {
  readonly label: string;
  readonly url: string;
}

export interface DashboardWidget {
  readonly id: string;
  readonly kind: DashboardWidgetKind;
  /** Unset: the built-in shape (see `TILE_SPAN`), or small for custom widgets. */
  readonly size?: DashboardWidgetSize;
  /** Custom widgets: the title the user gave it. */
  readonly title?: string;
  /** Note widgets: the text. */
  readonly text?: string;
  /** Link widgets: the links, in order. */
  readonly links?: readonly DashboardLink[];
}

export interface DashboardLayout {
  readonly widgets: readonly DashboardWidget[];
  /**
   * Built-ins this layout has seen. One the user removed stays removed; one
   * added to Polaris after the layout was saved is appended.
   */
  readonly seen: readonly DashboardTileId[];
}

/** Stored shape: lenient strings, repaired by `normalizeLayout` before use. */
export const StoredDashboardLayout = Schema.Struct({
  widgets: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      kind: Schema.String,
      size: Schema.optionalKey(Schema.String),
      title: Schema.optionalKey(Schema.String),
      text: Schema.optionalKey(Schema.String),
      links: Schema.optionalKey(
        Schema.Array(Schema.Struct({ label: Schema.String, url: Schema.String })),
      ),
    }),
  ),
  seen: Schema.Array(Schema.String),
});
export type StoredDashboardLayout = typeof StoredDashboardLayout.Type;

/** The order-only layout of the first dashboard release. */
export const LegacyDashboardTileOrder = Schema.Array(Schema.String);
export const LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY = "polaris:dashboard-layout:v1";
export const DASHBOARD_LAYOUT_STORAGE_KEY = "polaris:dashboard-layout:v2";

/**
 * Footprint of a built-in left at its own size: two shapes, both filling every
 * row in the default order. With a long thread list the threads widget runs two
 * rows beside Start and Today, and pull requests share the last row with
 * activity; with a short one it stays one row, pull requests widen, and activity
 * spans the bottom. `grid-flow-dense` back-fills around anything moved.
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

/** Thread rows from which the threads widget takes the tall shape. */
export const THREADS_TALL_FROM_ROWS = 5;

export function threadsTileIsTall(threadRows: number): boolean {
  return threadRows >= THREADS_TALL_FROM_ROWS;
}

export function dashboardTileSpan(id: DashboardTileId, threadRows: number): string {
  return TILE_SPAN[threadsTileIsTall(threadRows) ? "tall" : "short"][id];
}

const isTileId = (value: string): value is DashboardTileId =>
  (DASHBOARD_TILE_IDS as readonly string[]).includes(value);
const isCustomKind = (value: string): value is CustomWidgetKind =>
  (CUSTOM_WIDGET_KINDS as readonly string[]).includes(value);
const isSize = (value: string | undefined): value is DashboardWidgetSize =>
  value !== undefined && (DASHBOARD_WIDGET_SIZES as readonly string[]).includes(value);

export function isBuiltInWidget(kind: DashboardWidgetKind): kind is DashboardTileId {
  return isTileId(kind);
}

/** The grid classes for a widget: its chosen size, else its built-in shape. */
export function dashboardWidgetSpan(widget: DashboardWidget, threadRows: number): string {
  if (widget.size !== undefined) {
    // A tall threads list keeps its two rows at any width but full.
    const tall =
      widget.kind === "threads" && widget.size !== "full" && threadsTileIsTall(threadRows);
    return tall ? `${SIZE_SPAN[widget.size]} lg:row-span-2` : SIZE_SPAN[widget.size];
  }
  return isTileId(widget.kind) ? dashboardTileSpan(widget.kind, threadRows) : SIZE_SPAN.small;
}

export function defaultDashboardLayout(): DashboardLayout {
  return {
    widgets: DASHBOARD_TILE_IDS.map((kind) => ({ id: kind, kind })),
    seen: [...DASHBOARD_TILE_IDS],
  };
}

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

/** The first release's order, as a layout. */
export function layoutFromLegacyOrder(order: readonly string[]): DashboardLayout {
  const tiles = normalizeTileOrder(order);
  return { widgets: tiles.map((kind) => ({ id: kind, kind })), seen: [...DASHBOARD_TILE_IDS] };
}

/**
 * A stored layout made safe to render: unknown kinds and sizes, repeated ids
 * and second copies of a built-in dropped; links without a URL dropped;
 * built-ins Polaris added since it was saved appended.
 */
export function normalizeLayout(stored: StoredDashboardLayout): DashboardLayout {
  const ids = new Set<string>();
  const builtIns = new Set<DashboardTileId>();
  const widgets: DashboardWidget[] = [];
  for (const raw of stored.widgets) {
    if (ids.has(raw.id) || raw.id.trim() === "") continue;
    const kind = isTileId(raw.kind) ? raw.kind : isCustomKind(raw.kind) ? raw.kind : null;
    if (kind === null) continue;
    if (isTileId(kind)) {
      if (builtIns.has(kind)) continue;
      builtIns.add(kind);
    }
    ids.add(raw.id);
    const links = raw.links?.filter((link) => link.url.trim() !== "");
    widgets.push({
      id: raw.id,
      kind,
      ...(isSize(raw.size) ? { size: raw.size } : {}),
      ...(raw.title === undefined ? {} : { title: raw.title }),
      ...(raw.text === undefined ? {} : { text: raw.text }),
      ...(links === undefined ? {} : { links }),
    });
  }
  const seen = new Set(stored.seen.filter(isTileId));
  for (const kind of DASHBOARD_TILE_IDS) {
    if (!seen.has(kind) && !builtIns.has(kind)) widgets.push({ id: kind, kind });
    seen.add(kind);
  }
  return { widgets, seen: [...seen] };
}

export function toStoredLayout(layout: DashboardLayout): StoredDashboardLayout {
  return {
    widgets: layout.widgets.map((widget) => ({
      id: widget.id,
      kind: widget.kind,
      ...(widget.size === undefined ? {} : { size: widget.size }),
      ...(widget.title === undefined ? {} : { title: widget.title }),
      ...(widget.text === undefined ? {} : { text: widget.text }),
      ...(widget.links === undefined ? {} : { links: widget.links.map((link) => ({ ...link })) }),
    })),
    seen: [...layout.seen],
  };
}

/** The layout with widget `id` moved to `toIndex` (clamped). */
export function moveWidget(layout: DashboardLayout, id: string, toIndex: number): DashboardLayout {
  const widget = layout.widgets.find((candidate) => candidate.id === id);
  if (widget === undefined) return layout;
  const rest = layout.widgets.filter((candidate) => candidate.id !== id);
  const at = Math.max(0, Math.min(rest.length, toIndex));
  return { ...layout, widgets: [...rest.slice(0, at), widget, ...rest.slice(at)] };
}

export function removeWidget(layout: DashboardLayout, id: string): DashboardLayout {
  return { ...layout, widgets: layout.widgets.filter((widget) => widget.id !== id) };
}

/** Built-ins not on the board, which "Add widget" offers back. */
export function missingBuiltIns(layout: DashboardLayout): readonly DashboardTileId[] {
  const shown = new Set(layout.widgets.map((widget) => widget.kind));
  return DASHBOARD_TILE_IDS.filter((kind) => !shown.has(kind));
}

/**
 * Adds a widget at the end: a built-in comes back once; a custom one gets the
 * caller's fresh id and a starter title.
 */
export function addWidget(
  layout: DashboardLayout,
  kind: DashboardWidgetKind,
  freshId: string,
): DashboardLayout {
  if (isTileId(kind)) {
    if (layout.widgets.some((widget) => widget.kind === kind)) return layout;
    return { ...layout, widgets: [...layout.widgets, { id: kind, kind }] };
  }
  const starter: DashboardWidget =
    kind === "note"
      ? { id: freshId, kind, title: "Note", text: "" }
      : { id: freshId, kind, title: "Links", links: [] };
  return { ...layout, widgets: [...layout.widgets, starter] };
}

export function updateWidget(
  layout: DashboardLayout,
  id: string,
  patch: Partial<Omit<DashboardWidget, "id" | "kind">>,
): DashboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)),
  };
}

export function isDefaultLayout(layout: DashboardLayout): boolean {
  return (
    layout.widgets.length === DASHBOARD_TILE_IDS.length &&
    layout.widgets.every(
      (widget, index) => widget.kind === DASHBOARD_TILE_IDS[index] && widget.size === undefined,
    )
  );
}

/**
 * A link's target: an in-app path (`/usage`) stays in Polaris; a web address
 * opens outside it. Bare hosts get `https://`. Anything else is refused.
 */
export function resolveDashboardLink(
  url: string,
): { readonly kind: "internal" | "external"; readonly href: string } | null {
  const value = url.trim();
  if (value === "") return null;
  if (value.startsWith("/") && !value.startsWith("//")) return { kind: "internal", href: value };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return { kind: "external", href: parsed.toString() };
  } catch {
    return null;
  }
}

/**
 * Where a link goes, in a few characters: the host for a web address
 * (`github.com`), the path for an in-app one. Null when the label already
 * says it, or the link cannot be opened.
 */
export function dashboardLinkHint(link: DashboardLink): string | null {
  const target = resolveDashboardLink(link.url);
  if (target === null) return null;
  const hint =
    target.kind === "internal" ? target.href : new URL(target.href).hostname.replace(/^www\./, "");
  const label = link.label.trim().toLowerCase();
  return label === hint.toLowerCase() || label === link.url.trim().toLowerCase() ? null : hint;
}
