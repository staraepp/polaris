import type { EnvironmentId } from "@t3tools/contracts";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import { useMemo, useState } from "react";

import { type ImportCandidate, ImportCandidateList } from "~/components/onboarding/WelcomeWizard";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  onboardingProjectKey,
  partitionOnboardingProjects,
} from "~/onboarding/projectImport.logic";
import type { useProjectScans } from "~/onboarding/useProjectScans";
import { agentSessionImport } from "~/state/agentSessions";
import { useAtomCommand } from "~/state/use-atom-command";

import { ImportFooter, SelectionBar } from "./ImportFooter";
import { summarizeImport } from "./sessionImport";
import { useImportRun } from "./useImportRun";

const SCAN_LIMIT_MESSAGE = "Scan limit reached. Some projects or conversations may be missing.";

type ProjectScan = ReturnType<typeof useProjectScans>[number];

/** Claude Code and Codex sessions from this computer (the welcome wizard's picker). */
export function SessionsPanel({
  environmentId,
  scan,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly scan: ProjectScan | null;
}) {
  const importThreads = useAtomCommand(agentSessionImport, { reportFailure: false });
  const { running, progress, summary, run } = useImportRun();

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

  const runImport = async () => {
    const done = await run(
      selected,
      async (target, projectId) => {
        const result = await importThreads({
          environmentId: target.environmentId,
          input: { projectId, expectedWorkspaceRoot: target.path },
        });
        return result._tag === "Success"
          ? { ok: true, value: result.value }
          : { ok: false, interrupted: isAtomCommandInterrupted(result) };
      },
      summarizeImport,
    );
    if (done) scan?.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Bring in Claude Code and Codex sessions
        </h2>
        <p className="text-sm text-muted-foreground">
          Polaris reads the session files those CLIs keep on this computer and turns each
          conversation into a thread under its project. Nothing leaves your machine. Run it again
          whenever you like: it never duplicates a thread. Finished conversations come in settled,
          so look for them under Settled in the sidebar.
        </p>
      </header>

      {environmentId === null || scan === null ? (
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
          <SelectionBar
            selectedCount={selected.length}
            totalCount={candidates.length}
            disabled={running}
            onSelectAll={() =>
              setSelectedChoice(new Set(candidates.map((candidate) => candidate.key)))
            }
            onSelectNone={() => setSelectedChoice(new Set())}
          />
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

      {candidates.length > 0 ? (
        <ImportFooter
          progress={progress}
          summary={summary}
          selectedCount={selected.length}
          noun={["folder", "folders"]}
          onImport={() => void runImport()}
        />
      ) : null}
    </div>
  );
}
