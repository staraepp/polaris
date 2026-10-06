import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vite-plus/test";

import { docToMarkdown } from "./docMarkdown";

const text = (value: string, marks?: JSONContent["marks"]): JSONContent =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

describe("docToMarkdown", () => {
  it("writes the title as the top heading, then the blocks", () => {
    expect(
      docToMarkdown(
        "Launch plan",
        doc(
          { type: "heading", attrs: { level: 2 }, content: [text("Goals")] },
          paragraph(text("Ship it "), text("soon", [{ type: "bold" }]), text(".")),
          { type: "horizontalRule" },
        ),
      ),
    ).toBe("# Launch plan\n\n## Goals\n\nShip it **soon**.\n\n---\n");
  });

  it("handles marks, links and inline code", () => {
    expect(
      docToMarkdown(
        "",
        doc(
          paragraph(
            text("site", [
              { type: "link", attrs: { href: "https://example.com" } },
              { type: "bold" },
            ]),
            text(" and "),
            text("a`b", [{ type: "code" }]),
            text(" and "),
            text("gone", [{ type: "strike" }, { type: "italic" }]),
          ),
        ),
      ),
    ).toBe("[**site**](https://example.com) and `` a`b `` and *~~gone~~*\n");
  });

  it("escapes Markdown characters typed as text", () => {
    expect(docToMarkdown("", doc(paragraph(text("2 * 3 = [six]"))))).toBe("2 \\* 3 = \\[six\\]\n");
  });

  it("writes nested bullet, ordered and task lists", () => {
    const item = (...content: JSONContent[]): JSONContent => ({ type: "listItem", content });
    expect(
      docToMarkdown(
        "",
        doc(
          {
            type: "bulletList",
            content: [
              item(paragraph(text("one")), {
                type: "bulletList",
                content: [item(paragraph(text("one.a")))],
              }),
              item(paragraph(text("two"))),
            ],
          },
          {
            type: "orderedList",
            attrs: { start: 3 },
            content: [item(paragraph(text("third"))), item(paragraph(text("fourth")))],
          },
          {
            type: "taskList",
            content: [
              { type: "taskItem", attrs: { checked: true }, content: [paragraph(text("done"))] },
              { type: "taskItem", attrs: { checked: false }, content: [paragraph(text("todo"))] },
            ],
          },
        ),
      ),
    ).toBe("- one\n  - one.a\n- two\n\n3. third\n4. fourth\n\n- [x] done\n- [ ] todo\n");
  });

  it("writes quotes and fenced code with its language", () => {
    expect(
      docToMarkdown(
        "",
        doc(
          { type: "blockquote", content: [paragraph(text("first")), paragraph(text("second"))] },
          { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1;")] },
        ),
      ),
    ).toBe("> first\n>\n> second\n\n```ts\nconst a = 1;\n```\n");
  });

  it("drops empty paragraphs and survives an empty doc", () => {
    expect(docToMarkdown("", doc(paragraph(), paragraph(text("x")), paragraph()))).toBe("x\n");
    expect(docToMarkdown("Only a title", null)).toBe("# Only a title\n");
  });
});
