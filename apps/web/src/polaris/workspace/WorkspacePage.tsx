import { Link, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { toastManager } from "~/components/ui/toast";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { formatRelativeTimeLabel } from "~/timestampFormat";

import { HubTabPanel, HubTabs } from "../hub/HubTabs";
import { DeleteDialog, RenameDialog, WorkspaceKindIcon } from "./WorkspaceChrome";
import {
  displayTitle,
  filterWorkspaceItems,
  KIND_LABEL,
  type WorkspaceFilter,
  type WorkspaceItem,
  type WorkspaceKind,
} from "./workspaceModel";
import { createWorkspaceItem, useWorkspaceItems } from "./workspaceStore";

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "doc", label: "Docs" },
  { id: "board", label: "Boards" },
] as const satisfies readonly { id: WorkspaceFilter; label: string }[];

/** Opens a fresh doc or board; shared by this page, the sidebar and the palette. */
export function useCreateWorkspaceItem(): (kind: WorkspaceKind) => Promise<void> {
  const navigate = useNavigate();
  return async (kind) => {
    try {
      const item = await createWorkspaceItem(kind);
      await (kind === "doc"
        ? navigate({ to: "/workspace/doc/$docId", params: { docId: item.id } })
        : navigate({ to: "/workspace/board/$boardId", params: { boardId: item.id } }));
    } catch (error) {
      toastManager.add({
        type: "error",
        title: `Could not create a ${kind}`,
        description: error instanceof Error ? error.message : "The Workspace storage failed.",
      });
    }
  };
}

/**
 * The Workspace hub (Polaris, V 5.0.0): your docs and boards. Kept on this
 * device for now; syncing them through the Polaris server comes later.
 */
export function WorkspacePage() {
  const state = useWorkspaceItems();
  const create = useCreateWorkspaceItem();
  const [filter, setFilter] = useState<WorkspaceFilter>("all");
  const [query, setQuery] = useState("");
  const items = state.status === "ready" ? state.items : [];
  const shown = filterWorkspaceItems(items, filter, query);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Workspace breadcrumb" className="min-w-0 flex-1">
            <WorkspaceBreadcrumbItem current>
              <h1>Workspace</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          <Button size="sm" variant="outline" onClick={() => void create("board")}>
            <PlusIcon />
            Board
          </Button>
          <Button size="sm" onClick={() => void create("doc")}>
            <PlusIcon />
            Doc
          </Button>
        </WorkspacePageHeader>
        <ScrollArea className="min-h-0 flex-1">
          <WorkspacePageContainer width="wide">
            {state.status === "error" ? (
              <p role="alert" className="text-sm text-destructive-foreground">
                {state.message}
              </p>
            ) : state.status === "ready" && items.length === 0 ? (
              <EmptyWorkspace onCreate={(kind) => void create(kind)} />
            ) : (
              <HubTabs
                tabs={FILTER_TABS}
                value={filter}
                onValueChange={setFilter}
                ariaLabel="Show"
                className="gap-4"
              >
                <InputGroup className="max-w-sm">
                  <InputGroupAddon>
                    <SearchIcon aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    aria-label="Search the Workspace"
                    placeholder="Search by title"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </InputGroup>
                {FILTER_TABS.map((tab) => (
                  <HubTabPanel key={tab.id} value={tab.id}>
                    {shown.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {state.status === "loading" ? "Loading…" : "Nothing matches."}
                      </p>
                    ) : (
                      <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
                        {shown.map((item) => (
                          <WorkspaceCard key={item.id} item={item} />
                        ))}
                      </ul>
                    )}
                  </HubTabPanel>
                ))}
              </HubTabs>
            )}
          </WorkspacePageContainer>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}

function WorkspaceCard({ item }: { readonly item: WorkspaceItem }) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const title = displayTitle(item);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const linkClass =
    "flex min-h-28 flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 pe-11 text-card-foreground transition-colors outline-none hover:border-border hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring";
  const body = (
    <>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary-text">
        <WorkspaceKindIcon kind={item.kind} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">
          {KIND_LABEL[item.kind]} · edited {formatRelativeTimeLabel(item.updatedAt)}
        </span>
      </span>
    </>
  );

  return (
    <li className="relative">
      {item.kind === "doc" ? (
        <Link to="/workspace/doc/$docId" params={{ docId: item.id }} className={linkClass}>
          {body}
        </Link>
      ) : (
        <Link to="/workspace/board/$boardId" params={{ boardId: item.id }} className={linkClass}>
          {body}
        </Link>
      )}
      <div className="absolute top-3 right-3">
        <Menu>
          <MenuTrigger
            render={<Button size="icon-sm" variant="ghost" aria-label={`More for ${title}`} />}
          >
            <EllipsisIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => setDialog("rename")}>Rename…</MenuItem>
            <MenuItem variant="destructive" onClick={() => setDialog("delete")}>
              Delete…
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      {dialog === "rename" ? <RenameDialog item={item} open onOpenChange={close} /> : null}
      <DeleteDialog item={item} open={dialog === "delete"} onOpenChange={close} />
    </li>
  );
}

function EmptyWorkspace({ onCreate }: { readonly onCreate: (kind: WorkspaceKind) => void }) {
  const choices = [
    {
      kind: "doc",
      title: "Write a doc",
      text: "Plans, specs and notes. Headings, lists and to-dos; type “/” for blocks.",
    },
    {
      kind: "board",
      title: "Start a board",
      text: "An Excalidraw whiteboard for sketches, flows and diagrams.",
    },
  ] as const;
  return (
    <section aria-labelledby="workspace-empty-title" className="flex flex-col gap-4 pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="workspace-empty-title" className="text-lg font-semibold">
          Your Workspace is empty
        </h2>
        <p className="text-sm text-muted-foreground">
          Docs and boards are saved on this device as you work.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => (
          <button
            key={choice.kind}
            type="button"
            onClick={() => onCreate(choice.kind)}
            className="flex flex-col items-start gap-3 rounded-xl border border-border/70 bg-card p-5 text-start transition-colors outline-none hover:border-border hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary-text">
              <WorkspaceKindIcon kind={choice.kind} className="size-4.5" />
            </span>
            <span className="text-sm font-medium">{choice.title}</span>
            <span className="text-sm text-muted-foreground">{choice.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
