/**
 * Polaris (V 5.0.0): the doc editor's "/" commands, Notion style. Typing "/"
 * opens the list; more letters filter it by label and keywords.
 */
import type { Editor, Range } from "@tiptap/core";

export const DOC_COMMAND_IDS = [
  "text",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "taskList",
  "quote",
  "codeBlock",
  "divider",
] as const;
export type DocCommandId = (typeof DOC_COMMAND_IDS)[number];

export interface DocCommand {
  readonly id: DocCommandId;
  readonly label: string;
  readonly hint: string;
  readonly keywords: readonly string[];
}

export const DOC_COMMANDS: readonly DocCommand[] = [
  { id: "text", label: "Text", hint: "Plain paragraph", keywords: ["paragraph", "plain", "p"] },
  { id: "heading1", label: "Heading 1", hint: "Big section title", keywords: ["h1", "title"] },
  { id: "heading2", label: "Heading 2", hint: "Medium section title", keywords: ["h2"] },
  { id: "heading3", label: "Heading 3", hint: "Small section title", keywords: ["h3"] },
  {
    id: "bulletList",
    label: "Bulleted list",
    hint: "A simple list",
    keywords: ["ul", "unordered", "bullet", "-"],
  },
  {
    id: "orderedList",
    label: "Numbered list",
    hint: "A list with numbers",
    keywords: ["ol", "ordered", "1."],
  },
  {
    id: "taskList",
    label: "To-do list",
    hint: "Track tasks with checkboxes",
    keywords: ["todo", "task", "checkbox", "check", "[]"],
  },
  { id: "quote", label: "Quote", hint: "Set a passage apart", keywords: ["blockquote", ">"] },
  {
    id: "codeBlock",
    label: "Code",
    hint: "A block of code",
    keywords: ["codeblock", "snippet", "```", "pre"],
  },
  {
    id: "divider",
    label: "Divider",
    hint: "A line between sections",
    keywords: ["hr", "rule", "---"],
  },
];

/** Commands matching what follows the "/": label words first, then keywords. */
export function filterDocCommands(query: string): DocCommand[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...DOC_COMMANDS];
  const rank = (command: DocCommand) => {
    const label = command.label.toLowerCase();
    if (label.startsWith(needle)) return 0;
    if (label.split(/\s+/).some((word) => word.startsWith(needle))) return 1;
    if (command.keywords.some((keyword) => keyword.startsWith(needle))) return 2;
    return label.includes(needle) ? 3 : null;
  };
  return DOC_COMMANDS.flatMap((command) => {
    const score = rank(command);
    return score === null ? [] : [{ command, score }];
  })
    .toSorted((a, b) => a.score - b.score)
    .map(({ command }) => command);
}

/** Replaces the typed "/query" with the chosen block. */
export function runDocCommand(editor: Editor, range: Range, id: DocCommandId): void {
  const chain = editor.chain().focus().deleteRange(range);
  switch (id) {
    case "text":
      chain.setParagraph().run();
      return;
    case "heading1":
      chain.setHeading({ level: 1 }).run();
      return;
    case "heading2":
      chain.setHeading({ level: 2 }).run();
      return;
    case "heading3":
      chain.setHeading({ level: 3 }).run();
      return;
    case "bulletList":
      chain.toggleBulletList().run();
      return;
    case "orderedList":
      chain.toggleOrderedList().run();
      return;
    case "taskList":
      chain.toggleTaskList().run();
      return;
    case "quote":
      chain.toggleBlockquote().run();
      return;
    case "codeBlock":
      chain.toggleCodeBlock().run();
      return;
    case "divider":
      chain.setHorizontalRule().run();
      return;
  }
}
