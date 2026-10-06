import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, PolarisT3HistoryProject } from "@t3tools/contracts";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Spinner } from "~/components/ui/spinner";
import { formatRelativeTime } from "~/timestampFormat";
import { useAtomCommand } from "~/state/use-atom-command";

import { ImportFooter, SelectionBar } from "./ImportFooter";
import { defaultT3Selection, summarizeT3Import, t3UnavailableText } from "./t3HistoryImport";
import { t3HistoryImport } from "./t3HistoryState";
import { useImportRun } from "./useImportRun";
import { useT3HistoryScan } from "./useT3HistoryScan";

const EMPTY: readonly PolarisT3HistoryProject[] = [];

function age(lastActiveAt: string | null) {
  if (lastActiveAt === null) return "";
  const relative = formatRelativeTime(lastActiveAt);
  if (relative === null) return "";
  return relative.suffix === null ? "now" : relative.value;
}

/** Copy threads from the T3 Code app on this computer into Polaris. */
export function T3HistoryPanel({
  environmentId,
}: {
  readonly environmentId: EnvironmentId | null;
}) {
  const scan = useT3HistoryScan(environmentId);
  const importProject = useAtomCommand(t3HistoryImport, { reportFailure: false });
  const { running, progress, summary, run } = useImportRun();
  const projects = scan.data?._tag === "available" ? scan.data.projects : EMPTY;

  const [selectedChoice, setSelectedChoice] = useState<ReadonlySet<string> | null>(null);
  const selectedKeys = useMemo(
    () => selectedChoice ?? defaultT3Selection(projects),
    [selectedChoice, projects],
  );
  const selected = projects.filter((project) => selectedKeys.has(project.sourceProjectId));
  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    setSelectedChoice(next);
  };

  const runImport = async () => {
    if (environmentId === null) return;
    let already = 0;
    const done = await run(
      selected.map((project) => ({
        key: project.sourceProjectId,
        environmentId,
        path: project.workspaceRoot,
        title: project.title,
      })),
      async (target, projectId) => {
        const result = await importProject({
          environmentId: target.environmentId,
          input: {
            sourceProjectId: target.key,
            projectId,
            expectedWorkspaceRoot: target.path,
          },
        });
        if (result._tag !== "Success") {
          return { ok: false, interrupted: isAtomCommandInterrupted(result) };
        }
        already += result.value.skippedCount;
        return { ok: true, value: { importedCount: result.value.importedCount, skippedCount: 0 } };
      },
      (outcomes) => summarizeT3Import(outcomes, already),
    );
    if (done) {
      setSelectedChoice(null);
      scan.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Bring over your T3 Code threads</h2>
        <p className="text-sm text-muted-foreground">
          Polaris copies the threads of the projects you pick from the T3 Code app on this computer.
          T3 Code itself is only read, never changed, and nothing leaves your machine. Threads that
          are already here are skipped, so you can run it again later.
        </p>
      </header>

      {scan.data === null && scan.isPending ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Spinner size="md" />
          Looking for T3 Code…
        </div>
      ) : scan.error !== null ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
        >
          <span>Could not read T3 Code's history. {scan.error}</span>
          <Button variant="outline" size="sm" onClick={scan.refresh}>
            Retry
          </Button>
        </div>
      ) : scan.data?._tag === "unavailable" ? (
        <p className="py-2 text-sm text-muted-foreground">{t3UnavailableText(scan.data.reason)}</p>
      ) : projects.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">T3 Code has no threads to bring over.</p>
      ) : (
        <section aria-label="T3 Code projects" className="space-y-2">
          <SelectionBar
            selectedCount={selected.length}
            totalCount={projects.length}
            disabled={running}
            onSelectAll={() =>
              setSelectedChoice(new Set(projects.map((project) => project.sourceProjectId)))
            }
            onSelectNone={() => setSelectedChoice(new Set())}
          />
          <fieldset
            disabled={running}
            className="min-w-0 space-y-0.5 rounded-lg border border-border/70 p-1.5"
          >
            <legend className="sr-only">T3 Code projects to import</legend>
            {projects.map((project) => {
              const all = project.importedThreadCount >= project.threadCount;
              return (
                <label
                  key={project.sourceProjectId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40 has-disabled:cursor-default"
                >
                  <Checkbox
                    checked={selectedKeys.has(project.sourceProjectId)}
                    onCheckedChange={(value) => toggle(project.sourceProjectId, value === true)}
                  />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{project.title}</span>
                    <span className="truncate font-mono text-2xs text-muted-foreground">
                      {project.workspaceRoot}
                    </span>
                  </span>
                  {all ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
                      In Polaris
                    </span>
                  ) : project.importedThreadCount > 0 ? (
                    <span className="shrink-0 text-2xs text-muted-foreground">
                      {project.threadCount - project.importedThreadCount} new
                    </span>
                  ) : null}
                  <span className="grid shrink-0 grid-cols-[2.5rem_2.25rem] items-center gap-x-1 text-right text-xs text-muted-foreground tabular-nums">
                    <span>
                      {project.threadCount}
                      <span className="sr-only">
                        {project.threadCount === 1 ? " thread" : " threads"}
                      </span>
                    </span>
                    <span>{age(project.lastActiveAt)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </section>
      )}

      {projects.length > 0 ? (
        <ImportFooter
          progress={progress}
          summary={summary}
          selectedCount={selected.length}
          noun={["project", "projects"]}
          onImport={() => void runImport()}
        />
      ) : null}
    </div>
  );
}
