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
import { useEscapeToGoBack } from "~/hooks/useNavigateBack";
import { useProjects, useThreadShells } from "~/state/entities";
import { primaryServerProvidersAtom } from "~/state/server";
import { useUsage } from "~/state/usage";

import { type ActivityDay, ActivityTileBody } from "./ActivityTile";
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  DASHBOARD_TILE_IDS,
  DashboardTileOrder,
  type DashboardTileId,
  isDefaultTileOrder,
  moveTile,
  dashboardTileSpan,
  normalizeTileOrder,
  threadsTileIsTall,
} from "./dashboardLayout";
import { DashboardTile, type DashboardTileEditing, tileActionClassName } from "./DashboardTile";
import { selectDashboardThreads } from "./dashboardThreads";
import { PullRequestsTileBody } from "./PullRequestsTile";
import { StartTileBody } from "./StartTile";
import { ThreadsTileBody } from "./ThreadsTile";
import { UsageTileBody } from "./UsageTile";

/** Days read for the activity tile; it shows all of them when it spans the bottom row. */
const ACTIVITY_DAYS = 30;
const ACTIVITY_DAYS_NARROW = 14;

/**
 * The Polaris dashboard: a fixed bento of what is going on across projects.
 * "Edit layout" lets tiles be dragged (or moved with their arrow buttons)
 * into another order, kept on this device.
 */
export function DashboardPage() {
  const [storedOrder, setStoredOrder] = useLocalStorage(
    DASHBOARD_LAYOUT_STORAGE_KEY,
    [...DASHBOARD_TILE_IDS],
    DashboardTileOrder,
  );
  const order = useMemo(() => normalizeTileOrder(storedOrder), [storedOrder]);
  const [editing, setEditing] = useState(false);
  // Esc leaves edit mode first, then the page.
  useEscapeToGoBack(editing ? () => setEditing(false) : undefined);
  const [drag, setDrag] = useState<{
    readonly id: DashboardTileId;
    readonly over: DashboardTileId | null;
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

  const commit = (next: readonly DashboardTileId[]) => setStoredOrder([...next]);
  const editingFor = (id: DashboardTileId, index: number): DashboardTileEditing | null =>
    editing
      ? {
          index,
          count: order.length,
          dragging: drag?.id === id,
          dropTarget: drag?.over === id,
          onMove: (toIndex) => commit(moveTile(order, id, toIndex)),
          onDragStart: (event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", id);
            setDrag({ id, over: null });
          },
          onDragEnter: () => setDrag((current) => (current ? { ...current, over: id } : current)),
          onDragEnd: () => setDrag(null),
          onDrop: () => {
            if (drag && drag.id !== id) commit(moveTile(order, drag.id, index));
            setDrag(null);
          },
        }
      : null;

  const tiles: Record<
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

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Dashboard breadcrumb" className="min-w-0 flex-1">
            <WorkspaceBreadcrumbItem current>
              <h1>Dashboard</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          {editing && !isDefaultTileOrder(order) ? (
            <Button size="sm" variant="ghost" onClick={() => commit(DASHBOARD_TILE_IDS)}>
              Reset layout
            </Button>
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
            {editing ? "Done" : "Edit layout"}
          </Button>
        </WorkspacePageHeader>
        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide">
            {editing ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Drag tiles to reorder them, or use each tile's arrows. The order is kept on this
                device.
              </p>
            ) : null}
            <div className="grid grid-flow-dense grid-cols-1 lg:auto-rows-[minmax(11rem,auto)] gap-4 lg:grid-cols-6">
              {order.map((id, index) => (
                <DashboardTile
                  key={id}
                  title={tiles[id].title}
                  action={tiles[id].action}
                  editing={editingFor(id, index)}
                  className={dashboardTileSpan(id, threadRows)}
                >
                  {tiles[id].body}
                </DashboardTile>
              ))}
            </div>
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
