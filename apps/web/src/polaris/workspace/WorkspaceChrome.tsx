import { Link, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon, PenLineIcon, ShapesIcon, TextCursorInputIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { toastManager } from "~/components/ui/toast";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";

import { deleteWorkspaceItem, renameWorkspaceItem } from "./workspaceStore";
import {
  displayTitle,
  MAX_TITLE_LENGTH,
  type WorkspaceItem,
  type WorkspaceKind,
} from "./workspaceModel";

export function WorkspaceKindIcon({
  kind,
  className,
}: {
  readonly kind: WorkspaceKind;
  readonly className?: string;
}) {
  return kind === "doc" ? (
    <PenLineIcon aria-hidden className={className} />
  ) : (
    <ShapesIcon aria-hidden className={className} />
  );
}

/** Saves text as a file through the browser's download (Electron asks where). */
export function downloadTextFile(fileName: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const storageError = (title: string, error: unknown) =>
  toastManager.add({
    type: "error",
    title,
    description: error instanceof Error ? error.message : "The Workspace storage failed.",
  });

export function RenameDialog({
  item,
  open,
  onOpenChange,
}: {
  readonly item: WorkspaceItem;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const save = async () => {
    try {
      await renameWorkspaceItem(item.id, title);
      onOpenChange(false);
    } catch (error) {
      storageError("Could not rename", error);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename {item.kind}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              aria-label="Title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={displayTitle({ kind: item.kind, title: "" })}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function DeleteDialog({
  item,
  open,
  onOpenChange,
  onDeleted,
}: {
  readonly item: WorkspaceItem;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted?: () => void;
}) {
  const remove = async () => {
    try {
      await deleteWorkspaceItem(item.id);
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      storageError("Could not delete", error);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{displayTitle(item)}”?</AlertDialogTitle>
          <AlertDialogDescription>
            It is stored only on this device, so it cannot be brought back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
          <Button variant="destructive" onClick={() => void remove()}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

export interface ItemAction {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly run: () => void;
}

/**
 * The header of a doc or board: "Workspace / <title>", a quiet save status,
 * the item's actions, Rename (boards; a doc is renamed in its title) and
 * Delete (confirmed, then back to the Workspace).
 */
export function WorkspaceItemHeader({
  item,
  status,
  actions,
  canRename = false,
}: {
  readonly item: WorkspaceItem;
  readonly status: ReactNode;
  readonly actions: readonly ItemAction[];
  readonly canRename?: boolean;
}) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const title = displayTitle(item);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <WorkspacePageHeader electron={isElectron}>
      <WorkspaceBreadcrumb ariaLabel="Workspace breadcrumb" className="min-w-0 flex-1">
        <WorkspaceBreadcrumbItem className="max-sm:hidden">
          <Link
            to="/workspace"
            className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Workspace
          </Link>
        </WorkspaceBreadcrumbItem>
        <WorkspaceBreadcrumbSeparator className="max-sm:hidden" />
        <WorkspaceBreadcrumbItem current>
          <h1 className="flex min-w-0 items-center gap-1.5">
            <WorkspaceKindIcon
              kind={item.kind}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{title}</span>
          </h1>
        </WorkspaceBreadcrumbItem>
      </WorkspaceBreadcrumb>
      <span aria-live="polite" className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
        {status}
      </span>
      <Menu>
        <MenuTrigger
          render={<Button size="icon-sm" variant="ghost" aria-label={`More for ${title}`} />}
        >
          <EllipsisIcon />
        </MenuTrigger>
        <MenuPopup align="end">
          {canRename ? (
            <MenuItem onClick={() => setDialog("rename")}>
              <TextCursorInputIcon />
              Rename…
            </MenuItem>
          ) : null}
          {actions.map((action) => (
            <MenuItem key={action.label} onClick={action.run}>
              {action.icon}
              {action.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => setDialog("delete")}>
            Delete…
          </MenuItem>
        </MenuPopup>
      </Menu>
      {dialog === "rename" ? <RenameDialog item={item} open onOpenChange={close} /> : null}
      <DeleteDialog
        item={item}
        open={dialog === "delete"}
        onOpenChange={close}
        onDeleted={() => void navigate({ to: "/workspace" })}
      />
    </WorkspacePageHeader>
  );
}

/** Shown when a link points at an item that no longer exists here. */
export function MissingItem({ kind }: { readonly kind: WorkspaceKind }) {
  return (
    <div className="m-auto flex max-w-80 flex-col items-center gap-3 p-6 text-center">
      <WorkspaceKindIcon kind={kind} className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        This {kind} is not on this device. It may have been deleted, or made in another browser.
      </p>
      <Button size="sm" variant="outline" render={<Link to="/workspace" />}>
        Open the Workspace
      </Button>
    </div>
  );
}
