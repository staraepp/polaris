import { describe, expect, it } from "vite-plus/test";

import { defaultT3Selection, summarizeT3Import, t3UnavailableText } from "./t3HistoryImport";

const project = (id: string, threadCount: number, importedThreadCount: number) => ({
  sourceProjectId: id,
  title: id,
  workspaceRoot: `/work/${id}`,
  threadCount,
  importedThreadCount,
  lastActiveAt: null,
});

const outcome = (status: "imported" | "failed" | "interrupted", importedCount = 0) => ({
  key: status,
  status,
  importedCount,
  skippedCount: 0,
});

describe("defaultT3Selection", () => {
  it("picks projects that still have threads Polaris does not have", () => {
    expect([
      ...defaultT3Selection([project("new", 3, 0), project("done", 2, 2), project("some", 4, 1)]),
    ]).toEqual(["new", "some"]);
  });
});

describe("summarizeT3Import", () => {
  it("counts new threads and the ones already here", () => {
    expect(summarizeT3Import([outcome("imported", 3), outcome("imported", 0)], 2)).toEqual({
      tone: "success",
      text: "Imported 3 threads from 1 project. 2 were already in Polaris.",
    });
  });

  it("says when nothing was new", () => {
    expect(summarizeT3Import([outcome("imported")], 4)).toEqual({
      tone: "neutral",
      text: "Nothing new: those threads are already in Polaris.",
    });
  });

  it("warns about failed and interrupted projects", () => {
    const summary = summarizeT3Import(
      [outcome("imported", 1), outcome("failed"), outcome("interrupted")],
      0,
    );
    expect(summary.tone).toBe("warning");
    expect(summary.text).toBe(
      "Imported 1 thread from 1 project. 1 project could not be imported. Try again. 1 project was interrupted before finishing.",
    );
  });
});

describe("t3UnavailableText", () => {
  it("explains each reason in words", () => {
    for (const reason of ["missing", "same-database", "unsupported"] as const) {
      expect(t3UnavailableText(reason).length).toBeGreaterThan(10);
    }
  });
});
