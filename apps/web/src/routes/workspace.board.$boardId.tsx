import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "../polaris/workspace/BoardPage";

export const Route = createFileRoute("/workspace/board/$boardId")({
  component: WorkspaceBoardRoute,
});

function WorkspaceBoardRoute() {
  const { boardId } = Route.useParams();
  return <BoardPage boardId={boardId} />;
}
