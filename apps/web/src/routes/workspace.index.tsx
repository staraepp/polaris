import { createFileRoute } from "@tanstack/react-router";

import { WorkspacePage } from "../polaris/workspace/WorkspacePage";

export const Route = createFileRoute("/workspace/")({
  component: WorkspacePage,
});
