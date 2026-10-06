import type { PullRequestListInput } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { readPullRequestListPreferences } from "~/components/pullRequest/pullRequestListPreferences";
import type { EnvironmentPullRequestEntry } from "~/components/pullRequest/pullRequestList.logic";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { useEnvironments } from "~/state/environments";
import { usePullRequestList, type EnvironmentQueryTarget } from "~/state/pullRequests";

const ROWS = 6;

/** The newest open pull requests across connected servers (Polaris dashboard). */
export function newestOpenPullRequests(
  entries: readonly EnvironmentPullRequestEntry[],
  limit: number,
): readonly EnvironmentPullRequestEntry[] {
  return entries
    .filter((entry) => entry.state === "open")
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export function PullRequestsTileBody() {
  const { environments } = useEnvironments();
  const targets = useMemo<ReadonlyArray<EnvironmentQueryTarget<PullRequestListInput>>>(
    () =>
      environments
        .filter((environment) => environment.serverConfig?.environment.capabilities.pullRequests)
        .map((environment) => environment.environmentId)
        .toSorted()
        .map((environmentId) => ({
          environmentId,
          input: { state: "open", involvement: "all", limit: 3 },
        })),
    [environments],
  );
  const { data, error, isPending } = usePullRequestList(targets);
  const rows = useMemo(() => newestOpenPullRequests(data?.entries ?? [], ROWS), [data]);

  if (targets.length === 0) {
    return (
      <p className="m-auto max-w-60 text-center text-sm text-muted-foreground">
        Pull requests show up here once a connected server can read your repositories.
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="m-auto max-w-60 text-center text-sm text-muted-foreground">
        {isPending ? "Reading pull requests…" : error ? error : "No open pull requests."}
      </p>
    );
  }
  const preferences = readPullRequestListPreferences();
  return (
    <ul className="flex flex-col">
      {rows.map((entry) => {
        const Glyph = entry.isDraft ? PullRequestGlyph.draft : PullRequestGlyph.pullRequest;
        return (
          <li key={`${entry.environmentId} ${entry.host} ${entry.repository} ${entry.number}`}>
            <Link
              to="/pull-requests"
              search={{
                ...preferences,
                repository: entry.repository,
                number: entry.number,
                selectedProjectId: entry.projectId,
                selectedHost: entry.host,
                selectedEnvironmentId: entry.environmentId,
              }}
              className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Glyph
                aria-hidden="true"
                className={
                  entry.isDraft
                    ? "size-4 shrink-0 text-muted-foreground"
                    : "size-4 shrink-0 text-primary-text"
                }
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{entry.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {entry.repository} #{entry.number}
                  {entry.isDraft ? " · Draft" : ""}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
