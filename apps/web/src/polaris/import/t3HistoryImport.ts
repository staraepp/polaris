import type {
  PolarisT3HistoryProject,
  PolarisT3HistoryScanResult,
  PolarisT3HistoryUnavailableReason,
} from "@t3tools/contracts";

import type { ImportOutcome, ImportSummary } from "./sessionImport";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Pre-select the T3 Code projects that still have threads Polaris does not have. */
export function defaultT3Selection(projects: readonly PolarisT3HistoryProject[]): Set<string> {
  return new Set(
    projects
      .filter((project) => project.importedThreadCount < project.threadCount)
      .map((project) => project.sourceProjectId),
  );
}

/**
 * How many T3 Code threads are not in Polaris yet (0 while scanning or when
 * T3 Code is not readable). Drives the hints that point people to the T3 Code
 * import (V 4.7.1): it sits on the Import page's second tab, and anyone who
 * set up Polaris before V 4.4.0 never saw the onboarding offer.
 */
export function t3NewThreadCount(scan: PolarisT3HistoryScanResult | null): number {
  if (scan?._tag !== "available") return 0;
  return scan.projects.reduce(
    (sum, project) => sum + Math.max(0, project.threadCount - project.importedThreadCount),
    0,
  );
}

/** Why the T3 Code section is empty, in words. */
export function t3UnavailableText(reason: PolarisT3HistoryUnavailableReason): string {
  switch (reason) {
    case "missing":
      return "T3 Code isn't on this computer, or it has no history yet.";
    case "same-database":
      return "Polaris is running on T3 Code's own data folder, so those threads are already here.";
    case "unsupported":
      return "This T3 Code version keeps its history in a format Polaris can't read yet.";
  }
}

/**
 * The T3 Code importer reports threads Polaris already had separately
 * (`alreadyCount`), so unlike the session import the counts here are new
 * threads only.
 */
export function summarizeT3Import(
  outcomes: readonly ImportOutcome[],
  alreadyCount: number,
): ImportSummary {
  const imported = outcomes.reduce((sum, outcome) => sum + outcome.importedCount, 0);
  const projects = outcomes.filter((outcome) => outcome.importedCount > 0).length;
  const failed = outcomes.filter((outcome) => outcome.status === "failed").length;
  const interrupted = outcomes.filter((outcome) => outcome.status === "interrupted").length;

  const parts: string[] = [];
  if (imported > 0) {
    parts.push(
      `Imported ${count(imported, "thread", "threads")} from ${count(projects, "project", "projects")}.`,
    );
    if (alreadyCount > 0) {
      parts.push(`${count(alreadyCount, "was", "were")} already in Polaris.`);
    }
  } else if (failed === 0 && interrupted === 0) {
    parts.push("Nothing new: those threads are already in Polaris.");
  }
  if (failed > 0) {
    parts.push(`${count(failed, "project", "projects")} could not be imported. Try again.`);
  }
  if (interrupted > 0) {
    parts.push(
      `${count(interrupted, "project was", "projects were")} interrupted before finishing.`,
    );
  }
  const tone =
    failed > 0 || interrupted > 0 ? "warning" : imported > 0 ? "success" : ("neutral" as const);
  return { tone, text: parts.join(" ") };
}
