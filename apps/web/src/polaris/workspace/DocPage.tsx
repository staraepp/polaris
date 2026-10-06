import type { JSONContent } from "@tiptap/core";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ClipboardCopyIcon, DownloadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { toastManager } from "~/components/ui/toast";
import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";

import { docToMarkdown } from "./docMarkdown";
import { SlashCommandMenu, type SlashMenuState, slashCommands } from "./SlashCommandMenu";
import { SAVE_STATUS_LABEL, useAutosave } from "./useAutosave";
import { downloadTextFile, MissingItem, WorkspaceItemHeader } from "./WorkspaceChrome";
import { exportFileName, MAX_TITLE_LENGTH, type WorkspaceItem } from "./workspaceModel";
import { loadDoc, renameWorkspaceItem, saveDoc, useWorkspaceItem } from "./workspaceStore";
import "./workspace.css";

/** A Workspace doc: a title and a Notion-style page, saved as you type. */
export function DocPage({ docId }: { readonly docId: string }) {
  const item = useWorkspaceItem(docId);
  const [content, setContent] = useState<{ id: string; doc: JSONContent | null } | null>(null);
  useEffect(() => {
    let live = true;
    loadDoc(docId).then(
      (doc) => live && setContent({ id: docId, doc }),
      () => live && setContent({ id: docId, doc: null }),
    );
    return () => {
      live = false;
    };
  }, [docId]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {item === null ? (
          <MissingItem kind="doc" />
        ) : item === "loading" || content?.id !== docId ? null : (
          <DocEditor key={docId} item={item} initialDoc={content.doc} />
        )}
      </div>
    </SidebarInset>
  );
}

function DocEditor({
  item,
  initialDoc,
}: {
  readonly item: WorkspaceItem;
  readonly initialDoc: JSONContent | null;
}) {
  // The title is local while typing; the stored record follows on save.
  const [title, setTitle] = useState(item.title);
  const [slash, setSlash] = useState<SlashMenuState | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const body = useAutosave((doc: JSONContent) => saveDoc(item.id, doc), 500);
  const name = useAutosave((next: string) => renameWorkspaceItem(item.id, next), 400);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading" : "Write, or type “/” for blocks",
      }),
      slashCommands(setSlash),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: initialDoc ?? "",
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "polaris-doc min-h-[50vh] outline-none",
        "aria-label": "Doc body",
      },
    },
    onUpdate: ({ editor: current }) => body.schedule(() => current.getJSON()),
  });

  // A brand-new doc starts with the caret in its title.
  const [startInTitle] = useState(() => item.title === "" && initialDoc === null);
  useEffect(() => {
    if (startInTitle) titleRef.current?.focus();
  }, [startInTitle]);

  const status =
    body.status === "error" || name.status === "error"
      ? SAVE_STATUS_LABEL.error
      : body.status === "saving" || name.status === "saving"
        ? SAVE_STATUS_LABEL.saving
        : body.status === "pending" || name.status === "pending"
          ? SAVE_STATUS_LABEL.pending
          : SAVE_STATUS_LABEL.saved;

  const markdown = () => docToMarkdown(title, editor?.getJSON() ?? null);
  const shownItem = { ...item, title };

  return (
    <>
      <WorkspaceItemHeader
        item={shownItem}
        status={status}
        actions={[
          {
            label: "Copy as Markdown",
            icon: <ClipboardCopyIcon />,
            run: () => {
              writeTextToClipboard(markdown(), "doc").then(
                () => toastManager.add({ type: "success", title: "Copied as Markdown" }),
                (error: unknown) =>
                  toastManager.add({
                    type: "error",
                    title: "Could not copy",
                    description: error instanceof Error ? error.message : undefined,
                  }),
              );
            },
          },
          {
            label: "Download as Markdown",
            icon: <DownloadIcon />,
            run: () =>
              downloadTextFile(
                exportFileName(shownItem, "md"),
                markdown(),
                "text/markdown;charset=utf-8",
              ),
          },
        ]}
      />
      <ScrollArea className="min-h-0 flex-1">
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 pt-12 pb-64 sm:px-12">
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Untitled"
            aria-label="Doc title"
            spellCheck
            onChange={(event) => {
              const next = event.target.value.replace(/\n/g, " ");
              setTitle(next);
              name.schedule(() => next);
            }}
            onKeyDown={(event) => {
              // Enter or ArrowDown at the end moves into the body, like Notion.
              const atEnd = event.currentTarget.selectionStart === event.currentTarget.value.length;
              if (event.key === "Enter" || (event.key === "ArrowDown" && atEnd)) {
                event.preventDefault();
                // Synchronously: Tiptap's focus command waits a frame, and the
                // next keystroke would still land in the title.
                editor?.commands.setTextSelection(1);
                editor?.view.focus();
              }
            }}
            className="w-full resize-none bg-transparent text-4xl leading-tight font-semibold tracking-tight text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/50"
          />
          <EditorContent editor={editor} />
        </article>
      </ScrollArea>
      <SlashCommandMenu state={slash} />
    </>
  );
}
