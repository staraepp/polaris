import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  type ImportTarget,
  runSessionImport,
  type SessionImportDeps,
  summarizeImport,
} from "./sessionImport";

const environmentId = EnvironmentId.make("env-1");
const target = (name: string, projectId?: string): ImportTarget => ({
  key: name,
  environmentId,
  path: `/work/${name}`,
  title: name,
  ...(projectId ? { projectId: ProjectId.make(projectId) } : {}),
});

const deps = (overrides: Partial<SessionImportDeps> = {}) => {
  const calls: string[] = [];
  const base: SessionImportDeps = {
    existingProjectId: (t) => t.projectId ?? null,
    newProjectId: () => ProjectId.make("new-project"),
    createProject: async (t, id) => {
      calls.push(`create ${t.key} ${id}`);
      return { ok: true, value: null };
    },
    importThreads: async (t, id) => {
      calls.push(`import ${t.key} ${id}`);
      return { ok: true, value: { importedCount: 2, skippedCount: 0 } };
    },
  };
  return { calls, deps: { ...base, ...overrides } };
};

describe("runSessionImport", () => {
  it("creates a project only when the folder has none, then imports its sessions", async () => {
    const { calls, deps: d } = deps();
    const outcomes = await runSessionImport([target("a", "existing"), target("b")], d);
    expect(calls).toEqual(["import a existing", "create b new-project", "import b new-project"]);
    expect(outcomes.map((o) => o.status)).toEqual(["imported", "imported"]);
  });

  it("keeps going after a failed folder and reports interruptions apart from failures", async () => {
    const { deps: d } = deps({
      createProject: async (t) =>
        t.key === "b" ? { ok: false, interrupted: false } : { ok: true, value: null },
      importThreads: async (t) =>
        t.key === "c"
          ? { ok: false, interrupted: true }
          : { ok: true, value: { importedCount: 1, skippedCount: 1 } },
    });
    const outcomes = await runSessionImport([target("a"), target("b"), target("c")], d);
    expect(outcomes.map((o) => o.status)).toEqual(["partial", "failed", "interrupted"]);
  });

  it("stops between folders once cancelled and reports progress", async () => {
    let cancelled = false;
    const progress: string[] = [];
    const { deps: d } = deps({
      importThreads: async () => {
        cancelled = true;
        return { ok: true, value: { importedCount: 1, skippedCount: 0 } };
      },
      isCancelled: () => cancelled,
    });
    const outcomes = await runSessionImport(
      [target("a", "p"), target("b", "q")],
      d,
      (done, total) => progress.push(`${done}/${total}`),
    );
    expect(outcomes).toHaveLength(1);
    expect(progress).toEqual(["0/2", "1/2"]);
  });
});

describe("summarizeImport", () => {
  const outcome = (
    status: "imported" | "partial" | "failed" | "interrupted",
    imported = 0,
    skipped = 0,
  ) => ({
    key: status,
    status,
    importedCount: imported,
    skippedCount: skipped,
  });

  it("counts the threads now in Polaris and the folders they came from", () => {
    expect(
      summarizeImport([outcome("imported", 3), outcome("imported", 1), outcome("imported", 0)]),
    ).toEqual({
      tone: "success",
      text: "4 threads from 2 folders are in Polaris.",
    });
  });

  it("says when the folders had no sessions to import", () => {
    expect(summarizeImport([outcome("imported")])).toEqual({
      tone: "neutral",
      text: "No sessions to import in those folders.",
    });
  });

  it("warns about skipped sessions, failures and interruptions", () => {
    const summary = summarizeImport([
      outcome("partial", 1, 2),
      outcome("failed"),
      outcome("interrupted"),
    ]);
    expect(summary.tone).toBe("warning");
    expect(summary.text).toBe(
      "1 thread from 1 folder is in Polaris. 2 sessions could not be read, so they were skipped. 1 folder could not be imported. Try again. 1 folder was interrupted before finishing.",
    );
  });
});
