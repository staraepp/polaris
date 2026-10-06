/**
 * Polaris (V 5.0.0): a Workspace doc as Markdown, for "Copy as Markdown" and
 * the .md export, so a plan can be pasted into a chat for an agent. Covers
 * the nodes the doc editor offers (StarterKit plus task lists); anything else
 * falls back to its text.
 */
import type { JSONContent } from "@tiptap/core";

type Mark = NonNullable<JSONContent["marks"]>[number];

const markOrder = ["link", "bold", "italic", "strike", "code"] as const;

const escapeText = (text: string) => text.replace(/([\\`*_~[\]])/g, "\\$1");

function wrapMark(text: string, mark: Mark): string {
  switch (mark.type) {
    case "bold":
      return `**${text}**`;
    case "italic":
      return `*${text}*`;
    case "strike":
      return `~~${text}~~`;
    case "link": {
      const href = mark.attrs?.href;
      return typeof href === "string" && href ? `[${text}](${href})` : text;
    }
    default:
      return text;
  }
}

function inlineText(node: JSONContent): string {
  if (node.type === "hardBreak") return "\\\n";
  if (node.type !== "text") return (node.content ?? []).map(inlineText).join("");
  const raw = node.text ?? "";
  const marks = node.marks ?? [];
  if (marks.some((mark) => mark.type === "code")) {
    const fence = raw.includes("`") ? "``" : "`";
    const code = fence === "``" ? ` ${raw} ` : raw;
    return marks
      .filter((mark) => mark.type === "link")
      .reduce((text, mark) => wrapMark(text, mark), `${fence}${code}${fence}`);
  }
  // Inner marks first, the link outermost, so `[**bold**](url)` comes out right.
  return markOrder
    .toReversed()
    .flatMap((type) => marks.filter((mark) => mark.type === type))
    .reduce((text, mark) => wrapMark(text, mark), escapeText(raw));
}

const inline = (node: JSONContent) => (node.content ?? []).map(inlineText).join("");

const indent = (text: string, by: string) =>
  text
    .split("\n")
    .map((line, index) => (index === 0 || line === "" ? line : `${by}${line}`))
    .join("\n");

function listItems(node: JSONContent, marker: (index: number) => string): string {
  return (node.content ?? [])
    .map((item, index) => {
      const prefix = marker(index);
      const body = (item.content ?? []).map(block).join("\n");
      return `${prefix}${indent(body, " ".repeat(prefix.length))}`;
    })
    .join("\n");
}

function block(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return inline(node);
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `${"#".repeat(level)} ${inline(node)}`;
    }
    case "bulletList":
      return listItems(node, () => "- ");
    case "orderedList": {
      const start = Number(node.attrs?.start) || 1;
      return listItems(node, (index) => `${start + index}. `);
    }
    case "taskList":
      return (node.content ?? [])
        .map((item) => {
          const prefix = `- [${item.attrs?.checked === true ? "x" : " "}] `;
          const body = (item.content ?? []).map(block).join("\n");
          return `${prefix}${indent(body, "  ")}`;
        })
        .join("\n");
    case "blockquote":
      return (node.content ?? [])
        .map(block)
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "codeBlock": {
      const code = (node.content ?? []).map((child) => child.text ?? "").join("");
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      const fence = code.includes("```") ? "````" : "```";
      return `${fence}${language}\n${code}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    default:
      return node.content ? node.content.map(block).join("\n\n") : inlineText(node);
  }
}

/** The doc's title as a top heading, then its body. */
export function docToMarkdown(title: string, doc: JSONContent | null): string {
  const body = (doc?.content ?? [])
    .map(block)
    .filter((text) => text.trim() !== "")
    .join("\n\n");
  const heading = title.trim() ? `# ${title.trim()}` : "";
  return [heading, body].filter(Boolean).join("\n\n") + "\n";
}
