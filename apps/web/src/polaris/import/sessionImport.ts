import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

/**
 * Import sessions any time (Polaris): the welcome wizard's Claude Code and
 * Codex import, without the wizard. For each picked folder Polaris makes sure
 * a project exists, then asks the server to import that folder's sessions as
 * threads. Thread ids come from the session ids, so running it again never
 * duplicates a thread; it only adds what is new.
 */
export interface ImportTarget {
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly path: string;
  readonly title: string;
  /** The server's match for this folder, when a project already exists. */
  readonly projectId?: ProjectId | undefined;
}

export type ImportStepResult<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly interrupted: boolean };

export interface ThreadImportCounts {
  readonly importedCount: number;
  readonly skippedCount: number;
}

export interface SessionImportDeps {
  /** A project already rooted at this folder, from the server scan or the local snapshot. */
  readonly existingProjectId: (target: ImportTarget) => ProjectId | null;
  readonly newProjectId: () => ProjectId;
  readonly createProject: (
    target: ImportTarget,
    projectId: ProjectId,
  ) => Promise<ImportStepResult<unknown>>;
  readonly importThreads: (
    target: ImportTarget,
    projectId: ProjectId,
  ) => Promise<ImportStepResult<ThreadImportCounts>>;
  /** True once the page has gone away; the run stops between folders. */
  readonly isCancelled?: () => boolean;
}

export type ImportOutcomeStatus = "imported" | "partial" | "failed" | "interrupted";

export interface ImportOutcome {
  readonly key: string;
  readonly status: ImportOutcomeStatus;
  readonly importedCount: number;
  readonly skippedCount: number;
}

/** Imports folders one at a time, so a failure in one never stops the rest. */
export async function runSessionImport(
  targets: readonly ImportTarget[],
  deps: SessionImportDeps,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportOutcome[]> {
  const outcomes: ImportOutcome[] = [];
  const failed = (key: string, interrupted: boolean): ImportOutcome => ({
    key,
    status: interrupted ? "interrupted" : "failed",
    importedCount: 0,
    skippedCount: 0,
  });
  for (const target of targets) {
    if (deps.isCancelled?.()) break;
    onProgress?.(outcomes.length, targets.length);
    let projectId = deps.existingProjectId(target);
    if (projectId === null) {
      projectId = deps.newProjectId();
      const created = await deps.createProject(target, projectId);
      if (!created.ok) {
        outcomes.push(failed(target.key, created.interrupted));
        continue;
      }
    }
    const imported = await deps.importThreads(target, projectId);
    if (!imported.ok) {
      outcomes.push(failed(target.key, imported.interrupted));
      continue;
    }
    outcomes.push({
      key: target.key,
      status: imported.value.skippedCount > 0 ? "partial" : "imported",
      importedCount: imported.value.importedCount,
      skippedCount: imported.value.skippedCount,
    });
  }
  onProgress?.(outcomes.length, targets.length);
  return outcomes;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface ImportSummary {
  readonly tone: "success" | "neutral" | "warning";
  readonly text: string;
}

/**
 * One sentence for the result line under the list. The server counts a
 * session it imported on an earlier run as imported too (the thread is
 * already there, nothing is duplicated), so the text says how many threads
 * are in Polaris rather than how many are new.
 */
export function summarizeImport(outcomes: readonly ImportOutcome[]): ImportSummary {
  const imported = outcomes.reduce((sum, outcome) => sum + outcome.importedCount, 0);
  const skipped = outcomes.reduce((sum, outcome) => sum + outcome.skippedCount, 0);
  const failed = outcomes.filter((outcome) => outcome.status === "failed").length;
  const interrupted = outcomes.filter((outcome) => outcome.status === "interrupted").length;
  const foldersWithThreads = outcomes.filter((outcome) => outcome.importedCount > 0).length;

  const parts: string[] = [];
  if (imported > 0) {
    parts.push(
      `${count(imported, "thread", "threads")} from ${count(foldersWithThreads, "folder", "folders")} ${imported === 1 ? "is" : "are"} in Polaris.`,
    );
  } else if (failed === 0 && interrupted === 0 && skipped === 0) {
    parts.push("No sessions to import in those folders.");
  }
  if (skipped > 0) {
    parts.push(
      `${count(skipped, "session", "sessions")} could not be read, so ${skipped === 1 ? "it was" : "they were"} skipped.`,
    );
  }
  if (failed > 0) {
    parts.push(`${count(failed, "folder", "folders")} could not be imported. Try again.`);
  }
  if (interrupted > 0) {
    parts.push(`${count(interrupted, "folder was", "folders were")} interrupted before finishing.`);
  }
  const tone =
    failed > 0 || interrupted > 0 || skipped > 0 ? "warning" : imported > 0 ? "success" : "neutral";
  return { tone, text: parts.join(" ") };
}
