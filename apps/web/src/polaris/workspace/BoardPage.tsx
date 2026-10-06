import { DownloadIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { SidebarInset } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { useTheme } from "~/hooks/useTheme";

import { SAVE_STATUS_LABEL, useAutosave } from "./useAutosave";
import { downloadTextFile, MissingItem, WorkspaceItemHeader } from "./WorkspaceChrome";
import { displayTitle, exportFileName, type WorkspaceItem } from "./workspaceModel";
import { loadBoard, saveBoard, useWorkspaceItem } from "./workspaceStore";
import "./workspace.css";

const BoardCanvas = lazy(() => import("./BoardCanvas"));

const loading = (
  <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
    <Spinner className="size-4" />
    Opening the board…
  </div>
);

/** A Workspace board: an Excalidraw whiteboard, saved as you draw. */
export function BoardPage({ boardId }: { readonly boardId: string }) {
  const item = useWorkspaceItem(boardId);
  const [scene, setScene] = useState<{ id: string; scene: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    loadBoard(boardId).then(
      (stored) => live && setScene({ id: boardId, scene: stored }),
      () => live && setScene({ id: boardId, scene: null }),
    );
    return () => {
      live = false;
    };
  }, [boardId]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {item === null ? (
          <MissingItem kind="board" />
        ) : item === "loading" || scene?.id !== boardId ? (
          loading
        ) : (
          <BoardEditor key={boardId} item={item} initialScene={scene.scene} />
        )}
      </div>
    </SidebarInset>
  );
}

function BoardEditor({
  item,
  initialScene,
}: {
  readonly item: WorkspaceItem;
  readonly initialScene: string | null;
}) {
  const { resolvedTheme } = useTheme();
  // The latest saved scene, for Download, without asking Excalidraw again.
  const latestScene = useRef(initialScene);
  const autosave = useAutosave((scene: string) => {
    latestScene.current = scene;
    return saveBoard(item.id, scene);
  }, 800);

  return (
    <>
      <WorkspaceItemHeader
        item={item}
        canRename
        status={SAVE_STATUS_LABEL[autosave.status]}
        actions={[
          {
            label: "Download .excalidraw",
            icon: <DownloadIcon />,
            run: () => {
              void autosave.flush().then(() => {
                if (latestScene.current !== null) {
                  downloadTextFile(
                    exportFileName(item, "excalidraw"),
                    latestScene.current,
                    "application/vnd.excalidraw+json",
                  );
                }
              });
            },
          },
        ]}
      />
      <div className="relative min-h-0 flex-1" data-polaris-board data-polaris-backdrop-surface>
        <Suspense fallback={loading}>
          <BoardCanvas
            initialScene={initialScene}
            name={displayTitle(item)}
            theme={resolvedTheme}
            onSceneChange={autosave.schedule}
          />
        </Suspense>
      </div>
    </>
  );
}
