import * as Schema from "effect/Schema";
import { IsoDateTime, NonNegativeInt, ProjectId, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Polaris: import threads from the T3 Code app installed on the same computer.
 * The server reads T3 Code's own database (`~/.t3/userdata/state.sqlite`)
 * read-only, copies the chosen project's threads into Polaris, and lets the
 * legacy importer turn them into threads. T3 Code's files are never written.
 */
export const PolarisT3HistoryScanInput = Schema.Struct({});
export type PolarisT3HistoryScanInput = typeof PolarisT3HistoryScanInput.Type;

/** A T3 Code project with threads that can be copied into Polaris. */
export const PolarisT3HistoryProject = Schema.Struct({
  sourceProjectId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  workspaceRoot: TrimmedNonEmptyString,
  threadCount: NonNegativeInt,
  /** Threads of this project that Polaris already has. */
  importedThreadCount: NonNegativeInt,
  lastActiveAt: Schema.NullOr(IsoDateTime),
});
export type PolarisT3HistoryProject = typeof PolarisT3HistoryProject.Type;

/**
 * `missing`: no T3 Code database on this computer. `same-database`: Polaris
 * itself runs on T3 Code's data directory, so there is nothing to copy.
 * `unsupported`: a T3 Code version whose database this importer cannot read.
 */
export const PolarisT3HistoryUnavailableReason = Schema.Literals([
  "missing",
  "same-database",
  "unsupported",
]);
export type PolarisT3HistoryUnavailableReason = typeof PolarisT3HistoryUnavailableReason.Type;

export const PolarisT3HistoryScanResult = Schema.Union([
  Schema.TaggedStruct("available", {
    projects: Schema.Array(PolarisT3HistoryProject),
  }),
  Schema.TaggedStruct("unavailable", {
    reason: PolarisT3HistoryUnavailableReason,
  }),
]);
export type PolarisT3HistoryScanResult = typeof PolarisT3HistoryScanResult.Type;

export const PolarisT3HistoryImportInput = Schema.Struct({
  sourceProjectId: TrimmedNonEmptyString,
  /** The Polaris project the threads go into. */
  projectId: ProjectId,
  /** Refuse when the Polaris project no longer points at this folder. */
  expectedWorkspaceRoot: TrimmedNonEmptyString,
});
export type PolarisT3HistoryImportInput = typeof PolarisT3HistoryImportInput.Type;

export const PolarisT3HistoryImportResult = Schema.Struct({
  importedCount: NonNegativeInt,
  /** Threads Polaris already had; they are left as they are. */
  skippedCount: NonNegativeInt,
});
export type PolarisT3HistoryImportResult = typeof PolarisT3HistoryImportResult.Type;

export class PolarisT3HistoryError extends Schema.TaggedError<PolarisT3HistoryError>()(
  "PolarisT3HistoryError",
  {
    operation: Schema.Literals(["read-source", "find-project", "copy", "import"]),
    detail: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    switch (this.operation) {
      case "read-source":
        return "Could not read T3 Code's history.";
      case "find-project":
        return this.detail ?? "The Polaris project for this folder could not be found.";
      case "copy":
        return "Could not copy the threads from T3 Code.";
      case "import":
        return "The threads were copied but could not be opened in Polaris.";
    }
  }
}
