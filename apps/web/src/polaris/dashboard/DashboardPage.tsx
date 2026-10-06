import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { makeWindow } from "@t3tools/shared/usageFormat";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";

import { readPullRequestListPreferences } from "~/components/pullRequest/pullRequestListPreferences";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { sortScopedProjectsForSidebar } from "~/components/Sidebar.logic";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useScratchProject } from "~/hooks/useScratchProject";
import { useClientSettings } from "~/hooks/useSettings";
import { useEscapeToGoBack } from "~/hooks/useNavigateBack";
import { useProjects, useThreadShells } from "~/state/entities";
import { primaryServerProvidersAtom } from "~/state/server";
import { useUsage } from "~/state/usage";

import { type ActivityDay, ActivityTileBody } from "./ActivityTile";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "~/components/ui/menu";

import { DashboardGreeting } from "./DashboardGreeting";
import { FirstSteps } from "./FirstSteps";
import {
  addWidget,
  CUSTOM_WIDGET_KINDS,
  DASHBOARD_LAYOUT_STORAGE_KEY,
  type DashboardLayout,
  type DashboardTileId,
  type DashboardWidget,
  type DashboardWidgetKind,
  dashboardWidgetSpan,
  defaultDashboardLayout,
  isBuiltInWidget,
  isDefaultLayout,
  LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY,
  layoutFromLegacyOrder,
  missingBuiltIns,
  moveWidget,
  normalizeLayout,
  removeWidget,
  StoredDashboardLayout,
  threadsTileIsTall,
  toStoredLayout,
  updateWidget,
} from "./dashboardLayout";
import { DashboardTile, type DashboardTileEditing, tileActionClassName } from "./DashboardTile";
import { LinksWidgetBody } from "./LinksWidget";
import { NoteWidgetBody } from "./NoteWidget";
import { selectDashboardThreads } from "./dashboardThreads";
import { PullRequestsTileBody } from "./PullRequestsTile";
import { StartTileBody } from "./StartTile";
import { ThreadsTileBody } from "./ThreadsTile";
import { UsageTileBody } from "./UsageTile";

/** Days read for the activity tile; it shows all of them when it spans the bottom row. */
const ACTIVITY_DAYS = 30;
const ACTIVITY_DAYS_NARROW = 14;

const BUILT_IN_LABELS: Record<DashboardTileId, string> = {
  start: "Start",
  threads: "Threads",
  usage: "Today",
  pullRequests: "Pull requests",
  activity: "Activity",
};

const CUSTOM_LABELS = { note: "Note", links: "Links" } as const;

/** The first release kept only an order; a device that has one starts from it. */
function readLegacyLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return layoutFromLegacyOrder(parsed);
    }
  } catch {
    // A broken old value just means the default layout.
  }
  return defaultDashboardLayout();
}

const freshWidgetId = (kind: string) =>
  `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * The Polaris dashboard, where the app opens: a greeting with Orbie and a
 * bento of widgets. "Customize" lets widgets be dragged (or moved with their
 * arrows), resized, removed and added back, plus your own notes and link
 * lists; all of it is kept on this device.
 */
export function DashboardPage() {
  const [initialLayout] = useState(() => toStoredLayout(readLegacyLayout()));
  const [storedLayout, setStoredLayout] = useLocalStorage(
    DASHBOARD_LAYOUT_STORAGE_KEY,
    initialLayout,
    StoredDashboardLayout,
  );
  const layout = useMemo(() => normalizeLayout(storedLayout), [storedLayout]);
  const [editing, setEditing] = useState(false);
  const lookChanged = useClientSettings(
    (settings) =>
      settings.botAccessory !== "none" ||
      settings.backgroundEnabled ||
      Object.keys(settings.themeFonts).length > 0,
  );
  // Esc leaves edit mode first, then the page.
  useEscapeToGoBack(editing ? () => setEditing(false) : undefined);
  const [drag, setDrag] = useState<{
    readonly id: string;
    readonly over: string | null;
  } | null>(null);

  const projects = useProjects();
  const threads = useThreadShells();
  const providers = useAtomValue(primaryServerProvidersAtom);
  const { scratchWorkspaceRootFor } = useScratchProject();
  // The scratch folder behind "Start without a project" is not a project to list.
  const sortedProjects = useMemo(
    () =>
      sortScopedProjectsForSidebar(projects, threads, "updated_at")
        .filter(
          (project) => !isScratchProject(project, scratchWorkspaceRootFor(project.environmentId)),
        )
        .slice(0, 4),
    [projects, scratchWorkspaceRootFor, threads],
  );
  const { active, recent } = useMemo(
    () => selectDashboardThreads(threads, { active: 5, recent: 6 }),
    [threads],
  );
  // Day resolution keeps the window's key stable for the whole day.
  const [usageWindow] = useState(() => makeWindow(ACTIVITY_DAYS, undefined, "day"));
  const { merged, isPending } = useUsage(usageWindow);
  const activityDays = useMemo<readonly ActivityDay[]>(() => {
    const byDay = new Map(merged.daily.map((day) => [day.day, day]));
    const days: ActivityDay[] = [];
    const cursor = new Date(`${usageWindow.sinceDay}T12:00:00Z`);
    for (let index = 0; index < ACTIVITY_DAYS; index += 1) {
      const day = cursor.toISOString().slice(0, 10);
      const totals = byDay.get(day);
      days.push({ day, costUsd: totals?.costUsd ?? 0, totalTokens: totals?.totalTokens ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }, [merged.daily, usageWindow.sinceDay]);
  const today = activityDays.at(-1) ?? null;
  const threadRows = active.length + recent.length;
  // The short shape gives activity the whole bottom row, room for a month.
  const activityWide = !threadsTileIsTall(threadRows);
  const shownActivityDays = activityWide ? activityDays : activityDays.slice(-ACTIVITY_DAYS_NARROW);

  const commit = (next: DashboardLayout) => setStoredLayout(toStoredLayout(next));
  const editingFor = (widget: DashboardWidget, index: number): DashboardTileEditing | null =>
    editing
      ? {
          index,
          count: layout.widgets.length,
          dragging: drag?.id === widget.id,
          dropTarget: drag?.over === widget.id,
          onMove: (toIndex) => commit(moveWidget(layout, widget.id, toIndex)),
          onDragStart: (event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", widget.id);
            setDrag({ id: widget.id, over: null });
          },
          onDragEnter: () =>
            setDrag((current) => (current ? { ...current, over: widget.id } : current)),
          onDragEnd: () => setDrag(null),
          onDrop: () => {
            if (drag && drag.id !== widget.id) commit(moveWidget(layout, drag.id, index));
            setDrag(null);
          },
          size: widget.size ?? "auto",
          onResize: (size) => {
            const { size: _previous, ...rest } = widget;
            commit({
              ...layout,
              widgets: layout.widgets.map((candidate) =>
                candidate.id === widget.id
                  ? size === "auto"
                    ? rest
                    : { ...rest, size }
                  : candidate,
              ),
            });
          },
          onRemove: () => commit(removeWidget(layout, widget.id)),
          ...(isBuiltInWidget(widget.kind)
            ? {}
            : { onRename: (title: string) => commit(updateWidget(layout, widget.id, { title })) }),
        }
      : null;

  const builtIns: Record<
    DashboardTileId,
    { readonly title: string; readonly action?: ReactNode; readonly body: ReactNode }
  > = {
    start: { title: "Start", body: <StartTileBody projects={sortedProjects} /> },
    threads: {
      title: "Threads",
      body: <ThreadsTileBody active={active} recent={recent} projects={projects} />,
    },
    usage: {
      title: "Today",
      action: (
        <Link to="/usage" className={tileActionClassName}>
          Open Usage
        </Link>
      ),
      body: <UsageTileBody today={today} pending={isPending} providers={providers} />,
    },
    pullRequests: {
      title: "Pull requests",
      action: (
        <Link
          to="/pull-requests"
          search={readPullRequestListPreferences()}
          className={tileActionClassName}
        >
          View all
        </Link>
      ),
      body: <PullRequestsTileBody />,
    },
    activity: {
      title: activityWide ? "Last 30 days" : "Last two weeks",
      body: <ActivityTileBody days={shownActivityDays} pending={isPending} />,
    },
  };

  const widgetContent = (
    widget: DashboardWidget,
  ): { readonly title: string; readonly action?: ReactNode; readonly body: ReactNode } => {
    if (isBuiltInWidget(widget.kind)) return builtIns[widget.kind];
    const title = widget.title ?? CUSTOM_LABELS[widget.kind];
    if (widget.kind === "note") {
      return {
        title,
        body: (
          <NoteWidgetBody
            title={title}
            text={widget.text ?? ""}
            onChange={(text) => commit(updateWidget(layout, widget.id, { text }))}
          />
        ),
      };
    }
    return {
      title,
      body: (
        <LinksWidgetBody
          title={title}
          links={widget.links ?? []}
          onChange={(links) => commit(updateWidget(layout, widget.id, { links }))}
        />
      ),
    };
  };

  const missing = missingBuiltIns(layout);
  const add = (kind: DashboardWidgetKind) => commit(addWidget(layout, kind, freshWidgetId(kind)));

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Dashboard breadcrumb" className="min-w-0 flex-1">
            <WorkspaceBreadcrumbItem current>
              <h1>Dashboard</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          {editing && !isDefaultLayout(layout) ? (
            <Button size="sm" variant="ghost" onClick={() => commit(defaultDashboardLayout())}>
              Reset layout
            </Button>
          ) : null}
          {editing ? (
            <Menu>
              <MenuTrigger render={<Button size="sm" variant="outline" />}>Add widget</MenuTrigger>
              <MenuPopup align="end">
                {missing.length > 0 ? (
                  <MenuGroup>
                    <MenuGroupLabel>Put back</MenuGroupLabel>
                    {missing.map((kind) => (
                      <MenuItem key={kind} onClick={() => add(kind)}>
                        {BUILT_IN_LABELS[kind]}
                      </MenuItem>
                    ))}
                  </MenuGroup>
                ) : null}
                <MenuGroup>
                  <MenuGroupLabel>Your own</MenuGroupLabel>
                  {CUSTOM_WIDGET_KINDS.map((kind) => (
                    <MenuItem key={kind} onClick={() => add(kind)}>
                      {CUSTOM_LABELS[kind]}
                    </MenuItem>
                  ))}
                </MenuGroup>
              </MenuPopup>
            </Menu>
          ) : null}
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            aria-pressed={editing}
            onClick={() => {
              setEditing((value) => !value);
              setDrag(null);
            }}
          >
            {editing ? "Done" : "Customize"}
          </Button>
        </WorkspacePageHeader>
        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide">
            {editing ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Drag widgets to reorder them (or use their arrows), pick a size, remove what you do
                not need and add notes or links of your own. Kept on this device.
              </p>
            ) : (
              <>
                <DashboardGreeting active={active} />
                <FirstSteps
                  signals={{
                    hasProject: projects.length > 0,
                    hasThread: active.length + recent.length > 0,
                    dashboardCustomized: !isDefaultLayout(layout),
                    lookChanged,
                  }}
                  onCustomize={() => setEditing(true)}
                />
              </>
            )}
            {layout.widgets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                No widgets left. Choose Customize, then Add widget.
              </p>
            ) : null}
            <div className="grid grid-flow-dense grid-cols-1 lg:auto-rows-[minmax(11rem,auto)] gap-4 lg:grid-cols-6">
              {layout.widgets.map((widget, index) => {
                const content = widgetContent(widget);
                return (
                  <DashboardTile
                    key={widget.id}
                    title={content.title}
                    action={content.action}
                    editing={editingFor(widget, index)}
                    className={dashboardWidgetSpan(widget, threadRows)}
                  >
                    {content.body}
                  </DashboardTile>
                );
              })}
            </div>
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
