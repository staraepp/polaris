import { describe, expect, it } from "vite-plus/test";

import {
  dashboardLinkHint,
  addWidget,
  dashboardTileSpan,
  dashboardWidgetSpan,
  DASHBOARD_TILE_IDS,
  defaultDashboardLayout,
  isDefaultLayout,
  layoutFromLegacyOrder,
  missingBuiltIns,
  moveWidget,
  normalizeLayout,
  normalizeTileOrder,
  removeWidget,
  resolveDashboardLink,
  toStoredLayout,
  updateWidget,
} from "./dashboardLayout";

const kinds = (layout: { readonly widgets: readonly { readonly kind: string }[] }) =>
  layout.widgets.map((widget) => widget.kind);

describe("dashboard layout", () => {
  it("repairs a stored order: drops strangers and repeats, appends new tiles", () => {
    expect(normalizeTileOrder([])).toEqual(DASHBOARD_TILE_IDS);
    expect(normalizeTileOrder(["usage", "ghost", "usage", "start"])).toEqual([
      "usage",
      "start",
      "threads",
      "pullRequests",
      "activity",
    ]);
  });

  it("migrates the first release's saved order", () => {
    expect(kinds(layoutFromLegacyOrder(["activity", "start"]))).toEqual([
      "activity",
      "start",
      "threads",
      "usage",
      "pullRequests",
    ]);
  });

  it("repairs a stored layout and keeps removed built-ins removed", () => {
    const layout = normalizeLayout({
      widgets: [
        { id: "usage", kind: "usage", size: "huge" },
        { id: "usage", kind: "usage" },
        { id: "x", kind: "threads" },
        { id: "y", kind: "threads" },
        { id: "n1", kind: "note", title: "Ideas", text: "ship it", size: "large" },
        {
          id: "l1",
          kind: "links",
          links: [
            { label: "Docs", url: "" },
            { label: "PRs", url: "/pull-requests" },
          ],
        },
        { id: "z", kind: "weather" },
      ],
      seen: [...DASHBOARD_TILE_IDS],
    });
    expect(kinds(layout)).toEqual(["usage", "threads", "note", "links"]);
    expect(layout.widgets[0]).toEqual({ id: "usage", kind: "usage" });
    expect(layout.widgets[2]?.size).toBe("large");
    expect(layout.widgets[3]?.links).toEqual([{ label: "PRs", url: "/pull-requests" }]);
  });

  it("appends a built-in Polaris added after the layout was saved", () => {
    const layout = normalizeLayout({
      widgets: [{ id: "start", kind: "start" }],
      seen: ["start", "threads", "usage", "pullRequests"],
    });
    expect(kinds(layout)).toEqual(["start", "activity"]);
  });

  it("round-trips through storage", () => {
    const layout = addWidget(defaultDashboardLayout(), "note", "n1");
    expect(normalizeLayout(toStoredLayout(layout))).toEqual(layout);
  });

  it("moves, removes, re-adds, resizes and edits widgets", () => {
    let layout = defaultDashboardLayout();
    expect(isDefaultLayout(layout)).toBe(true);
    layout = moveWidget(layout, "activity", 0);
    expect(kinds(layout)[0]).toBe("activity");
    expect(isDefaultLayout(layout)).toBe(false);
    layout = removeWidget(layout, "usage");
    expect(missingBuiltIns(layout)).toEqual(["usage"]);
    layout = addWidget(layout, "usage", "ignored");
    expect(addWidget(layout, "usage", "again")).toBe(layout);
    layout = addWidget(layout, "links", "l1");
    expect(layout.widgets.at(-1)).toEqual({ id: "l1", kind: "links", title: "Links", links: [] });
    layout = updateWidget(layout, "l1", { size: "full", title: "Shortcuts" });
    expect(layout.widgets.at(-1)).toMatchObject({ size: "full", title: "Shortcuts" });
  });

  it("only lets the threads widget run two rows when it has rows to fill them", () => {
    expect(dashboardTileSpan("threads", 2)).not.toContain("row-span-2");
    expect(dashboardTileSpan("activity", 2)).toBe("lg:col-span-6");
    expect(dashboardTileSpan("threads", 8)).toContain("row-span-2");
    expect(dashboardTileSpan("activity", 8)).toBe("lg:col-span-3");
    expect(dashboardWidgetSpan({ id: "t", kind: "threads", size: "medium" }, 8)).toBe(
      "lg:col-span-3 lg:row-span-2",
    );
    expect(dashboardWidgetSpan({ id: "t", kind: "threads", size: "full" }, 8)).toBe(
      "lg:col-span-6",
    );
    expect(dashboardWidgetSpan({ id: "n", kind: "note" }, 8)).toBe("lg:col-span-2");
  });

  it("resolves links: in-app paths stay inside, web addresses open outside, the rest is refused", () => {
    expect(resolveDashboardLink("/usage")).toEqual({ kind: "internal", href: "/usage" });
    expect(resolveDashboardLink("github.com/me")).toEqual({
      kind: "external",
      href: "https://github.com/me",
    });
    expect(resolveDashboardLink("http://localhost:3000")?.kind).toBe("external");
    expect(resolveDashboardLink("javascript:alert(1)")).toBeNull();
    expect(resolveDashboardLink("//evil.example")).not.toEqual(
      expect.objectContaining({ kind: "internal" }),
    );
    expect(resolveDashboardLink("  ")).toBeNull();
  });
});

describe("dashboardLinkHint", () => {
  it("names the host or in-app path a link opens", () => {
    expect(dashboardLinkHint({ label: "Repo", url: "github.com/me/polaris" })).toBe("github.com");
    expect(dashboardLinkHint({ label: "Notes", url: "https://www.example.org/a/b" })).toBe(
      "example.org",
    );
    expect(dashboardLinkHint({ label: "Spend", url: "/usage" })).toBe("/usage");
  });

  it("stays quiet when the label already says it, or the link is broken", () => {
    expect(dashboardLinkHint({ label: "docs.example.com", url: "docs.example.com" })).toBeNull();
    expect(dashboardLinkHint({ label: "Example.org", url: "https://example.org/x" })).toBeNull();
    expect(dashboardLinkHint({ label: "Bad", url: "javascript:alert(1)" })).toBeNull();
  });
});
