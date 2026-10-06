import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { cn } from "~/lib/utils";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import type { DashboardThread } from "./dashboardThreads";

function ThreadRow({
  entry,
  projectTitle,
}: {
  readonly entry: DashboardThread;
  readonly projectTitle: string | undefined;
}) {
  const { thread, status } = entry;
  return (
    <li>
      <Link
        to="/$environmentId/$threadId"
        params={{ environmentId: thread.environmentId, threadId: thread.id }}
        className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            status ? status.dotClass : "bg-border",
            status?.pulse && "motion-safe:animate-pulse",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-foreground">{thread.title || "Untitled"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {projectTitle ?? "Project"}
            {status ? (
              <>
                {" · "}
                <span className={status.colorClass}>{status.label}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatRelativeTimeLabel(thread.updatedAt)}
        </span>
      </Link>
    </li>
  );
}

/** Threads that need the user, then the most recent ones (Polaris dashboard). */
export function ThreadsTileBody({
  active,
  recent,
  projects,
}: {
  readonly active: readonly DashboardThread[];
  readonly recent: readonly DashboardThread[];
  readonly projects: readonly EnvironmentProject[];
}) {
  const projectTitles = useMemo(
    () =>
      new Map(projects.map((project) => [`${project.environmentId} ${project.id}`, project.title])),
    [projects],
  );
  const titleOf = (entry: DashboardThread) =>
    projectTitles.get(`${entry.thread.environmentId} ${entry.thread.projectId}`);

  if (active.length === 0 && recent.length === 0) {
    return (
      <p className="m-auto max-w-56 text-center text-sm text-muted-foreground">
        No threads yet. Start one and it shows up here.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-col gap-3">
      {active.length > 0 ? (
        <div>
          <h3 className="px-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
            In motion
          </h3>
          <ul className="flex flex-col">
            {active.map((entry) => (
              <ThreadRow key={entry.thread.id} entry={entry} projectTitle={titleOf(entry)} />
            ))}
          </ul>
        </div>
      ) : null}
      {recent.length > 0 ? (
        <div>
          <h3 className="px-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
            Recent
          </h3>
          <ul className="flex flex-col">
            {recent.map((entry) => (
              <ThreadRow key={entry.thread.id} entry={entry} projectTitle={titleOf(entry)} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
