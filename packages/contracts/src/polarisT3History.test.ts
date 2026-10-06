import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { WS_METHODS } from "./rpc.ts";
import { PolarisT3HistoryImportInput, PolarisT3HistoryScanResult } from "./polarisT3History.ts";

const decodeScan = Schema.decodeUnknownSync(PolarisT3HistoryScanResult);
const decodeImport = Schema.decodeUnknownSync(PolarisT3HistoryImportInput);

describe("Polaris T3 Code history contract", () => {
  it("decodes available projects and every unavailable reason", () => {
    expect(
      decodeScan({
        _tag: "available",
        projects: [
          {
            sourceProjectId: "p1",
            title: "Site",
            workspaceRoot: "/work/site",
            threadCount: 4,
            importedThreadCount: 1,
            lastActiveAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toMatchObject({ _tag: "available", projects: [{ threadCount: 4 }] });
    for (const reason of ["missing", "same-database", "unsupported"]) {
      expect(decodeScan({ _tag: "unavailable", reason })).toEqual({ _tag: "unavailable", reason });
    }
    expect(() => decodeScan({ _tag: "unavailable", reason: "other" })).toThrow();
  });

  it("requires the folder the Polaris project must still point at", () => {
    expect(() => decodeImport({ sourceProjectId: "p1", projectId: "polaris-1" })).toThrow();
    expect(
      decodeImport({ sourceProjectId: "p1", projectId: "polaris-1", expectedWorkspaceRoot: "/w" }),
    ).toMatchObject({ expectedWorkspaceRoot: "/w" });
  });

  it("adds two new methods without renaming existing ones", () => {
    expect(WS_METHODS.polarisT3HistoryScan).toBe("polaris.t3History.scan");
    expect(WS_METHODS.polarisT3HistoryImport).toBe("polaris.t3History.import");
    expect(WS_METHODS.agentSessionsImport).toBe("agentSessions.import");
  });
});
