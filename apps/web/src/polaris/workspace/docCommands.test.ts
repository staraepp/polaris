import { describe, expect, it } from "vite-plus/test";

import { DOC_COMMAND_IDS, DOC_COMMANDS, filterDocCommands } from "./docCommands";

const ids = (query: string) => filterDocCommands(query).map((command) => command.id);

describe("doc slash commands", () => {
  it("lists every command once, in the declared order", () => {
    expect(DOC_COMMANDS.map((command) => command.id)).toEqual([...DOC_COMMAND_IDS]);
    expect(ids("")).toEqual([...DOC_COMMAND_IDS]);
  });

  it("puts label prefixes before word and keyword matches", () => {
    expect(ids("h")).toEqual(["heading1", "heading2", "heading3", "divider"]);
    expect(ids("list")).toEqual(["bulletList", "orderedList", "taskList"]);
    expect(ids("todo")).toEqual(["taskList"]);
  });

  it("matches keywords and ignores case and spaces", () => {
    expect(ids(" H2 ")).toEqual(["heading2"]);
    expect(ids("hr")).toEqual(["divider"]);
    expect(ids("zzz")).toEqual([]);
  });
});
