import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import { CommandId, type EnvironmentId } from "@t3tools/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

import { type ImportCandidate, ImportCandidateList } from "~/components/onboarding/WelcomeWizard";
import { Button } from "~/components/ui/button";
import { RefreshIcon } from "~/components/ui/refresh-icon";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useEscapeToGoBack } from "~/hooks/useNavigateBack";
import { cn, newProjectId } from "~/lib/utils";
import {
  onboardingProjectKey,
  partitionOnboardingProjects,
  resolveOnboardingProjectId,
} from "~/onboarding/projectImport.logic";
import { useProjectScans } from "~/onboarding/useProjectScans";
import { agentSessionImport } from "~/state/agentSessions";
import { readProjects } from "~/state/entities";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";

import { type ImportSummary, runSessionImport, summarizeImport } from "./sessionImport";

const NO_ENVIRONMENTS: readonly EnvironmentId[] = [];
const stayOnPage = () => {};
const SCAN_LIMIT_MESSAGE = "Scan limit reached. Some projects or conversations may be missing.";

/**
 * Import sessions any time (Polaris). The welcome wizard's Claude Code and
 * Codex import as its own page, so sessions started outside Polaris can be
 * brought in later. Only this computer's server is scanned.
 */
export function ImportSessionsPage() {
  const environmentId = usePrimaryEnvironmentId();
  const environmentIds = useMemo(
    () => (environmentId === null ? NO_ENVIRONMENTS : [environmentId]),
    [environmentId],
  );
  const scan = useProjectScans(environmentIds)[0] ?? null;
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const importThreads = useAtomCommand(agentSessionImport, { reportFailure: false });

  const { available: candidates, recent } = useMemo(() => {
    const scanned: ImportCandidate[] =
      scan === null
        ? []
        : (scan.data?.candidates ?? []).map((candidate) => ({
            ...candidate,
            environmentId: scan.environmentId,
            key: onboardingProjectKey(scan.environmentId, candidate.path),
          }));
    return partitionOnboardingProjects(scanned);
  }, [scan]);

  const [selectedChoice, setSelectedChoice] = useState<ReadonlySet<string> | null>(null);
  const selectedKeys = useMemo(
    () => selectedChoice ?? new Set(recent.map((candidate) => candidate.key)),
    [selectedChoice, recent],
  );
  const selected = candidates.filter((candidate) => selectedKeys.has(candidate.key));

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const running = progress !== null;
  useEscapeToGoBack(running ? stayOnPage : undefined);

  // Stop between folders if the page goes away mid-run.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const runImport = async () => {
    if (running || selected.length === 0) return;
    setSummary(null);
    setProgress({ done: 0, total: selected.length });
    const outcomes = await runSessionImport(
      selected,
      {
        existingProjectId: (target) =>
          resolveOnboardingProjectId(readProjects(), target.environmentId, target),
        newProjectId,
        createProject: async (target, projectId) => {
          const result = await createProject({
            environmentId: target.environmentId,
            input: {
              projectId,
              commandId: CommandId.make(`polaris-import:project:create:${projectId}`),
              title: target.title,
              workspaceRoot: target.path,
              createWorkspaceRootIfMissing: false,
              defaultModelSelection: null,
            },
          });
          return result._tag === "Success"
            ? { ok: true, value: null }
            : { ok: false, interrupted: isAtomCommandInterrupted(result) };
        },
        importThreads: async (target, projectId) => {
          const result = await importThreads({
            environmentId: target.environmentId,
            input: { projectId, expectedWorkspaceRoot: target.path },
          });
          return result._tag === "Success"
            ? { ok: true, value: result.value }
            : { ok: false, interrupted: isAtomCommandInterrupted(result) };
        },
        isCancelled: () => cancelledRef.current,
      },
      (done, total) => {
        if (!cancelledRef.current) setProgress({ done, total });
      },
    );
    if (cancelledRef.current) return;
    setProgress(null);
    setSummary(summarizeImport(outcomes));
    scan?.refresh();
  };

  const scanning = scan !== null && scan.isPending;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Import breadcrumb" className="min-w-0 flex-1">
            <WorkspaceBreadcrumbItem current>
              <h1>Import sessions</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={scanning ? "Looking for sessions" : "Look again"}
            disabled={scan === null || scanning || running}
            onClick={() => scan?.refresh()}
          >
            <RefreshIcon refreshing={scanning} />
          </Button>
        </WorkspacePageHeader>

        <ScrollArea scrollFade className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-8">
            <header className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                Bring in Claude Code and Codex sessions
              </h2>
              <p className="text-sm text-muted-foreground">
                Polaris reads the session files those CLIs keep on this computer and turns each
                conversation into a thread under its project. Nothing leaves your machine. Run it
                again whenever you like: it never duplicates a thread. Finished conversations come
                in settled, so look for them under Settled in the sidebar.
              </p>
            </header>

            {scan === null ? (
              <p className="text-sm text-muted-foreground">
                Connect to a Polaris server to look for sessions.
              </p>
            ) : scan.isPending && scan.data === null ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Spinner size="md" />
                Looking for sessions…
              </div>
            ) : scan.error !== null ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
              >
                <span>Could not look for sessions. {scan.error}</span>
                <Button variant="outline" size="sm" onClick={scan.refresh}>
                  Retry
                </Button>
              </div>
            ) : candidates.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No Claude Code or Codex sessions found on this computer.
              </p>
            ) : (
              <section aria-label="Folders with sessions" className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {selected.length} of {candidates.length} selected
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={running || selected.length === candidates.length}
                      onClick={() =>
                        setSelectedChoice(new Set(candidates.map((candidate) => candidate.key)))
                      }
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={running || selected.length === 0}
                      onClick={() => setSelectedChoice(new Set())}
                    >
                      Select none
                    </Button>
                  </div>
                </div>
                {scan.data?.truncated ? (
                  <p className="text-xs text-muted-foreground">{SCAN_LIMIT_MESSAGE}</p>
                ) : null}
                <fieldset
                  disabled={running}
                  className="min-w-0 space-y-0.5 rounded-lg border border-border/70 p-1.5"
                >
                  <legend className="sr-only">Folders to import</legend>
                  <ImportCandidateList
                    candidates={candidates}
                    selectedKeys={selectedKeys}
                    onSelectionChange={setSelectedChoice}
                  />
                </fieldset>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <p
                role="status"
                className={cn(
                  "mr-auto min-w-0 text-sm",
                  summary?.tone === "warning"
                    ? "text-warning-foreground"
                    : summary?.tone === "success"
                      ? "text-success-foreground"
                      : "text-muted-foreground",
                )}
              >
                {progress !== null
                  ? `Importing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                  : (summary?.text ?? "")}
              </p>
              {candidates.length > 0 ? (
                <Button
                  disabled={running || selected.length === 0}
                  onClick={() => void runImport()}
                >
                  {running ? <Spinner size="sm" /> : null}
                  {running
                    ? "Importing…"
                    : `Import ${selected.length} ${selected.length === 1 ? "folder" : "folders"}`}
                </Button>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
