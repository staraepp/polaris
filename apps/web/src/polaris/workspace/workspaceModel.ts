/**
 * Polaris (V 5.0.0): the Workspace's items. A doc (Tiptap) or a board
 * (Excalidraw), kept on this device. This file holds the plain record and the
 * pure rules around it; storage lives in `workspaceStore.ts`.
 */
export const WORKSPACE_KINDS = ["doc", "board"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export interface WorkspaceItem {
  readonly id: string;
  readonly kind: WorkspaceKind;
  /** As typed; empty until the user names it. Show it through `displayTitle`. */
  readonly title: string;
  /** ISO timestamps. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type WorkspaceFilter = "all" | WorkspaceKind;

export const MAX_TITLE_LENGTH = 200;

const UNTITLED: Record<WorkspaceKind, string> = {
  doc: "Untitled doc",
  board: "Untitled board",
};

export const KIND_LABEL: Record<WorkspaceKind, string> = { doc: "Doc", board: "Board" };

export const isWorkspaceKind = (value: unknown): value is WorkspaceKind =>
  value === "doc" || value === "board";

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/** Guards records read back from IndexedDB, which may predate this shape. */
export function isWorkspaceItem(value: unknown): value is WorkspaceItem {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    isWorkspaceKind(record.kind) &&
    typeof record.title === "string" &&
    isIsoDate(record.createdAt) &&
    isIsoDate(record.updatedAt)
  );
}

export function newWorkspaceItem(kind: WorkspaceKind, id: string, now: Date): WorkspaceItem {
  const at = now.toISOString();
  return { id, kind, title: "", createdAt: at, updatedAt: at };
}

/** One line, trimmed, capped. Line breaks typed into the title become spaces. */
export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

export function displayTitle(item: Pick<WorkspaceItem, "kind" | "title">): string {
  return normalizeTitle(item.title) || UNTITLED[item.kind];
}

/** Most recently edited first; ties keep a stable order by id. */
export function sortWorkspaceItems(items: readonly WorkspaceItem[]): WorkspaceItem[] {
  return items.toSorted(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id),
  );
}

export function filterWorkspaceItems(
  items: readonly WorkspaceItem[],
  filter: WorkspaceFilter,
  query: string,
): WorkspaceItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      (filter === "all" || item.kind === filter) &&
      (needle === "" || displayTitle(item).toLowerCase().includes(needle)),
  );
}

/** A file name for exports: the title without characters file systems refuse. */
export function exportFileName(item: Pick<WorkspaceItem, "kind" | "title">, extension: string) {
  const base =
    displayTitle(item)
      .replace(/[<>:"/\\|?*]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || UNTITLED[item.kind];
  return `${base}.${extension}`;
}
