// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { ProviderInstanceId } from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import {
  getOpenCodeSession,
  isPlaceholderOpenCodeTitle,
  listOpenCodeDatabases,
  listOpenCodeSessions,
  openCodeSessionPath,
  parseOpenCodeSessionPath,
  readOpenCodeSession,
} from "./openCodeSessionStore.ts";
import { seedOpenCodeDatabase, type SeedOpenCodeSession } from "./openCodeSessions.testkit.ts";
import {
  MAX_OPENCODE_IMPORTED_MESSAGES,
  openCodeImportIdentity,
  openCodeSessionThread,
} from "./openCodeSessionThread.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});

function tempDirectory(): string {
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "polaris-opencode-"));
  directories.push(directory);
  return directory;
}

const conversation: SeedOpenCodeSession["messages"] = [
  {
    id: "msg_1",
    at: 1100,
    data: { role: "user", model: { providerID: "anthropic", modelID: "claude-sonnet-5" } },
    parts: [
      { type: "text", text: "Tidy the parser" },
      { type: "text", text: "<system-reminder>", synthetic: true },
      { type: "file", url: "file:///work/app/parser.ts" },
    ],
  },
  {
    id: "msg_2",
    at: 1200,
    data: { role: "assistant", providerID: "openai", modelID: "gpt-5.5" },
    parts: [{ type: "tool", tool: "read" }],
  },
  {
    id: "msg_3",
    at: 1300,
    data: { role: "assistant", providerID: "openai", modelID: "gpt-5.5" },
    parts: [
      { type: "reasoning", text: "thinking" },
      { type: "text", text: "Done." },
      { type: "text", text: "Anything else?" },
      { type: "text", text: "hidden", ignored: true },
    ],
  },
];

describe("openCodeSessionStore", () => {
  it("round-trips session paths", () => {
    const path = openCodeSessionPath("/data/opencode.db", "ses_1");
    expect(parseOpenCodeSessionPath(path)).toEqual({
      databasePath: "/data/opencode.db",
      sessionId: "ses_1",
    });
    expect(parseOpenCodeSessionPath("/data/opencode.db")).toBeNull();
    expect(parseOpenCodeSessionPath("/data/opencode.db#session/")).toBeNull();
  });

  it("recognises OpenCode's placeholder titles", () => {
    expect(isPlaceholderOpenCodeTitle("New session - 2026-09-01T10:00:00.000Z")).toBe(true);
    expect(isPlaceholderOpenCodeTitle("New sessions page")).toBe(false);
    expect(isPlaceholderOpenCodeTitle("Fix the build")).toBe(false);
  });

  it("lists opencode.db first, then other channels, and nothing else", () => {
    const directory = tempDirectory();
    for (const name of ["opencode-dev.db", "opencode.db", "opencode.db-wal", "other.db"]) {
      NodeFS.writeFileSync(NodePath.join(directory, name), "");
    }
    expect(listOpenCodeDatabases(directory)).toEqual([
      NodePath.join(directory, "opencode.db"),
      NodePath.join(directory, "opencode-dev.db"),
    ]);
    expect(listOpenCodeDatabases(NodePath.join(directory, "missing"))).toEqual([]);
  });

  it("lists top-level, unarchived sessions newest first", () => {
    const path = NodePath.join(tempDirectory(), "opencode.db");
    seedOpenCodeDatabase(path, [
      { id: "ses_old", updated: 2000, messages: conversation },
      { id: "ses_new", updated: 5000, directory: "/work/other" },
      { id: "ses_child", parentId: "ses_old", updated: 9000 },
      { id: "ses_archived", archived: true, updated: 9000 },
    ]);
    const sessions = listOpenCodeSessions(path, 10);
    expect(sessions?.map((session) => session.id)).toEqual(["ses_new", "ses_old"]);
    expect(sessions?.[1]).toMatchObject({
      databasePath: path,
      directory: "/work/app",
      createdAtMs: 1000,
      updatedAtMs: 2000,
      messageCount: 3,
    });
    expect(listOpenCodeSessions(path, 1)?.map((session) => session.id)).toEqual(["ses_new"]);
    expect(getOpenCodeSession(path, "ses_child")).toBeNull();
    expect(getOpenCodeSession(path, "ses_archived")).toBeNull();
    expect(getOpenCodeSession(path, "ses_old")?.messageCount).toBe(3);
  });

  it("returns null for a file that is not an OpenCode database", () => {
    const path = NodePath.join(tempDirectory(), "opencode.db");
    NodeFS.writeFileSync(path, "not sqlite");
    expect(listOpenCodeSessions(path, 10)).toBeNull();
    expect(readOpenCodeSession(path, "ses_1")).toBeNull();
  });

  it("reads the visible text and the last model, skipping tool-only steps", () => {
    const path = NodePath.join(tempDirectory(), "opencode.db");
    seedOpenCodeDatabase(path, [{ id: "ses_1", messages: conversation }]);
    expect(readOpenCodeSession(path, "ses_1")).toEqual({
      messages: [
        { role: "user", text: "Tidy the parser", createdAtMs: 1100 },
        { role: "assistant", text: "Done.\n\nAnything else?", createdAtMs: 1300 },
      ],
      model: "openai/gpt-5.5",
    });
  });

  it("leaves the database untouched", () => {
    const path = NodePath.join(tempDirectory(), "opencode.db");
    seedOpenCodeDatabase(path, [{ id: "ses_1", messages: conversation }]);
    const before = NodeFS.readFileSync(path);
    listOpenCodeSessions(path, 10);
    readOpenCodeSession(path, "ses_1");
    expect(NodeFS.readFileSync(path).equals(before)).toBe(true);
  });
});

describe("openCodeSessionThread", () => {
  const providerInstanceId = ProviderInstanceId.make("opencode");
  const summary = {
    databasePath: "/data/opencode.db",
    id: "ses_1",
    directory: "/work/app",
    title: "Tidy the parser",
    createdAtMs: Date.UTC(2026, 8, 1),
    updatedAtMs: Date.UTC(2026, 8, 2),
    messageCount: 4,
  };
  const at = (minute: number) => Date.UTC(2026, 8, 1, 10, minute);
  const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

  it("identifies a session by its message count and last update", () => {
    expect(openCodeImportIdentity(summary)).toEqual({
      filePath: "/data/opencode.db#session/ses_1",
      size: 4,
      mtimeMs: summary.updatedAtMs,
      device: 0,
      inode: null,
      birthtimeMs: summary.createdAtMs,
    });
  });

  it("builds a thread titled after the session", () => {
    const thread = openCodeSessionThread({
      session: summary,
      contents: {
        messages: [
          { role: "user", text: "Tidy it", createdAtMs: at(0) },
          { role: "assistant", text: "Tidied", createdAtMs: at(1) },
        ],
        model: "openai/gpt-5.5",
      },
      providerInstanceId,
    });
    expect(thread).toMatchObject({
      source: "opencode",
      providerInstanceId,
      providerSessionId: "ses_1",
      title: "Tidy the parser",
      model: "openai/gpt-5.5",
      createdAt: iso(at(0)),
      updatedAt: iso(summary.updatedAtMs),
    });
    expect(thread?.messages.map((message) => message.text)).toEqual(["Tidy it", "Tidied"]);
  });

  it("titles placeholder sessions from the first user line", () => {
    const thread = openCodeSessionThread({
      session: { ...summary, title: "New session - 2026-09-01T10:00:00.000Z" },
      contents: {
        messages: [{ role: "user", text: "Rename the flag\nand its tests", createdAtMs: at(0) }],
        model: null,
      },
      providerInstanceId,
    });
    expect(thread?.title).toBe("Rename the flag");
  });

  it("keeps the first user message when trimming long sessions", () => {
    const messages = Array.from({ length: MAX_OPENCODE_IMPORTED_MESSAGES + 50 }, (_, index) => ({
      role: index === 0 ? ("user" as const) : ("assistant" as const),
      text: `message ${index}`,
      createdAtMs: at(index),
    }));
    const thread = openCodeSessionThread({
      session: summary,
      contents: { messages, model: null },
      providerInstanceId,
    });
    expect(thread?.messages).toHaveLength(MAX_OPENCODE_IMPORTED_MESSAGES);
    expect(thread?.messages[0]?.text).toBe("message 0");
    expect(thread?.messages[1]?.text).toBe("message 51");
    expect(thread?.messages.at(-1)?.text).toBe(`message ${MAX_OPENCODE_IMPORTED_MESSAGES + 49}`);
  });

  it("skips sessions without a user message", () => {
    expect(
      openCodeSessionThread({
        session: summary,
        contents: {
          messages: [{ role: "assistant", text: "Hi", createdAtMs: at(0) }],
          model: null,
        },
        providerInstanceId,
      }),
    ).toBeNull();
  });
});
