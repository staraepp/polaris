import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionMount } from "@tiptap/suggestion";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "~/lib/utils";

import {
  type DocCommand,
  type DocCommandId,
  filterDocCommands,
  runDocCommand,
} from "./docCommands";

const ICONS = {
  text: <PilcrowIcon />,
  heading1: <Heading1Icon />,
  heading2: <Heading2Icon />,
  heading3: <Heading3Icon />,
  bulletList: <ListIcon />,
  orderedList: <ListOrderedIcon />,
  taskList: <ListTodoIcon />,
  quote: <QuoteIcon />,
  codeBlock: <SquareCodeIcon />,
  divider: <MinusIcon />,
} as const satisfies Record<DocCommandId, ReactNode>;

export interface SlashMenuState {
  readonly items: readonly DocCommand[];
  readonly selected: number;
  readonly pick: (command: DocCommand) => void;
  readonly mount: SuggestionMount;
}

/**
 * The "/" menu as a Tiptap extension. It owns the keys while open (arrows,
 * Enter, Tab; the plugin itself handles Escape) and reports what to draw
 * through `onChange`, so the menu is plain React.
 */
export function slashCommands(onChange: (state: SlashMenuState | null) => void) {
  return Extension.create({
    name: "polarisSlashCommands",
    addProseMirrorPlugins() {
      let current: SlashMenuState | null = null;
      const publish = (next: SlashMenuState | null) => {
        current = next;
        onChange(next);
      };
      return [
        Suggestion<DocCommand, DocCommand>({
          editor: this.editor,
          char: "/",
          items: ({ query }) => filterDocCommands(query),
          command: ({ editor, range, props }) => runDocCommand(editor, range, props.id),
          // Not inside code, where "/" is just a character.
          allow: ({ editor }) => !editor.isActive("codeBlock"),
          floatingUi: { strategy: "fixed" },
          render: () => ({
            onStart: (props) =>
              publish({ items: props.items, selected: 0, pick: props.command, mount: props.mount }),
            onUpdate: (props) =>
              publish({ items: props.items, selected: 0, pick: props.command, mount: props.mount }),
            onKeyDown: ({ event }) => {
              if (!current || current.items.length === 0) return false;
              const count = current.items.length;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const step = event.key === "ArrowDown" ? 1 : -1;
                publish({ ...current, selected: (current.selected + step + count) % count });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                const chosen = current.items[current.selected];
                if (chosen) current.pick(chosen);
                return true;
              }
              return false;
            },
            onExit: () => publish(null),
          }),
        }),
      ];
    },
  });
}

export function SlashCommandMenu({ state }: { readonly state: SlashMenuState | null }) {
  const listRef = useRef<HTMLDivElement>(null);
  const mount = state?.mount;
  useEffect(() => {
    const element = listRef.current;
    if (!element || !mount) return;
    return mount(element);
  }, [mount]);
  const selected = state?.selected ?? 0;
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!state) return null;
  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      aria-label="Insert a block"
      className="dropdown-glass z-[130] max-h-80 w-64 overflow-y-auto rounded-lg p-1 shadow-lg"
    >
      {state.items.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">No matching block</p>
      ) : (
        state.items.map((command, index) => (
          <div
            key={command.id}
            role="option"
            aria-selected={index === state.selected}
            data-index={index}
            // Keep the caret in the editor; the click picks the block.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => state.pick(command)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground",
              index === state.selected && "bg-accent text-accent-foreground",
            )}
          >
            {ICONS[command.id]}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{command.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{command.hint}</span>
            </span>
          </div>
        ))
      )}
    </div>,
    document.body,
  );
}
