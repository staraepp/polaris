import { createFileRoute } from "@tanstack/react-router";

import { ImportSessionsPage } from "../polaris/import/ImportSessionsPage";

export const Route = createFileRoute("/import")({
  component: ImportSessionsPage,
});
