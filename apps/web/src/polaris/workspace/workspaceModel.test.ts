import { describe, expect, it } from "vite-plus/test";

import {
  displayTitle,
  exportFileName,
  filterWorkspaceItems,
  isWorkspaceItem,
  MAX_TITLE_LENGTH,
  newWorkspaceItem,
  normalizeTitle,
  sortWorkspaceItems,
  type WorkspaceItem,
} from "./workspaceModel";

const item = (overrides: Partial<WorkspaceItem> & Pick<WorkspaceItem, "id">): WorkspaceItem => ({
  kind: "doc",
  title: "",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

describe("workspace items", () => {
  it("creates an untitled item stamped with the same time twice", () => {
    const created = newWorkspaceItem("board", "b1", new Date("2026-10-06T12:00:00.000Z"));
    expect(created).toEqual({
      id: "b1",
      kind: "board",
      title: "",
      createdAt: "2026-10-06T12:00:00.000Z",
      updatedAt: "2026-10-06T12:00:00.000Z",
    });
    expect(displayTitle(created)).toBe("Untitled board");
  });

  it("accepts only well-formed records from storage", () => {
    expect(isWorkspaceItem(item({ id: "d1" }))).toBe(true);
    expect(isWorkspaceItem(null)).toBe(false);
    expect(isWorkspaceItem({ ...item({ id: "d1" }), kind: "sheet" })).toBe(false);
    expect(isWorkspaceItem({ ...item({ id: "" }) })).toBe(false);
    expect(isWorkspaceItem({ ...item({ id: "d1" }), updatedAt: "yesterday" })).toBe(false);
  });

  it("keeps titles to one trimmed, capped line", () => {
    expect(normalizeTitle("  Launch\n plan  ")).toBe("Launch plan");
    expect(normalizeTitle("x".repeat(MAX_TITLE_LENGTH + 20))).toHaveLength(MAX_TITLE_LENGTH);
    expect(displayTitle({ kind: "doc", title: "   " })).toBe("Untitled doc");
  });

  it("sorts by last edit, newest first, with a stable tie-break", () => {
    const sorted = sortWorkspaceItems([
      item({ id: "b", updatedAt: "2026-10-02T00:00:00.000Z" }),
      item({ id: "a", updatedAt: "2026-10-02T00:00:00.000Z" }),
      item({ id: "c", updatedAt: "2026-10-05T00:00:00.000Z" }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });

  it("filters by kind and by title, untitled items included", () => {
    const items = [
      item({ id: "d1", title: "Roadmap" }),
      item({ id: "b1", kind: "board", title: "Roadmap sketch" }),
      item({ id: "b2", kind: "board" }),
    ];
    expect(filterWorkspaceItems(items, "board", "").map((entry) => entry.id)).toEqual(["b1", "b2"]);
    expect(filterWorkspaceItems(items, "all", " roadMAP ").map((entry) => entry.id)).toEqual([
      "d1",
      "b1",
    ]);
    expect(filterWorkspaceItems(items, "all", "untitled").map((entry) => entry.id)).toEqual(["b2"]);
  });

  it("builds export file names file systems accept", () => {
    expect(exportFileName({ kind: "board", title: 'Q4: "big" plan?' }, "excalidraw")).toBe(
      "Q4 big plan.excalidraw",
    );
    expect(exportFileName({ kind: "doc", title: "" }, "md")).toBe("Untitled doc.md");
    expect(exportFileName({ kind: "doc", title: "///" }, "md")).toBe("Untitled doc.md");
  });
});
