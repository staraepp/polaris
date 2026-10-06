import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "../polaris/workspace/DocPage";

export const Route = createFileRoute("/workspace/doc/$docId")({
  component: WorkspaceDocRoute,
});

function WorkspaceDocRoute() {
  const { docId } = Route.useParams();
  return <DocPage docId={docId} />;
}
