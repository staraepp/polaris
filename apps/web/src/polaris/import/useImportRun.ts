import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import { CommandId } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";

import { newProjectId } from "~/lib/utils";
import { resolveOnboardingProjectId } from "~/onboarding/projectImport.logic";
import { readProjects } from "~/state/entities";
import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";

import {
  type ImportOutcome,
  type ImportSummary,
  type ImportTarget,
  runSessionImport,
  type SessionImportDeps,
} from "./sessionImport";

/**
 * One import run on the Import page, whatever the source: makes sure each
 * folder has a project, calls the source's import, tracks progress, stops
 * between folders if the page goes away, and keeps the result line.
 */
export function useImportRun() {
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const run = async (
    targets: readonly ImportTarget[],
    importThreads: SessionImportDeps["importThreads"],
    summarize: (outcomes: readonly ImportOutcome[]) => ImportSummary,
  ): Promise<boolean> => {
    if (progress !== null || targets.length === 0) return false;
    setSummary(null);
    setProgress({ done: 0, total: targets.length });
    const outcomes = await runSessionImport(
      targets,
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
        importThreads,
        isCancelled: () => cancelledRef.current,
      },
      (done, total) => {
        if (!cancelledRef.current) setProgress({ done, total });
      },
    );
    if (cancelledRef.current) return false;
    setProgress(null);
    setSummary(summarize(outcomes));
    return true;
  };

  return { running: progress !== null, progress, summary, run };
}
