import { createFileRoute } from "@tanstack/react-router";

import { ImportSessionsPage } from "../polaris/import/ImportSessionsPage";

export interface ImportSearch {
  readonly source?: "t3";
}

export const Route = createFileRoute("/import")({
  validateSearch: (search: Record<string, unknown>): ImportSearch =>
    search.source === "t3" ? { source: "t3" } : {},
  component: ImportSessionsPage,
});
