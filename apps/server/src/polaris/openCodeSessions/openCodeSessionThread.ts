/**
 * Polaris (V 5.4.0): an OpenCode session as an importable thread, with the
 * same rules as the Claude Code and Codex import (`AgentSessionScanner`): the
 * newest 200 messages plus the first user message, and a title from the
 * session or else the first line of the first message.
 */
import type { AgentSessionImportSource, ProviderInstanceId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import type {
  AgentSessionThread,
  AgentSessionThreadMessage,
} from "../../project/AgentSessionScanner.ts";
import {
  isPlaceholderOpenCodeTitle,
  openCodeSessionPath,
  type OpenCodeSessionContents,
  type OpenCodeSessionSummary,
} from "./openCodeSessionStore.ts";

export const MAX_OPENCODE_IMPORTED_MESSAGES = 200;

const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

/** The import identity of a session: it changes whenever the session does. */
export function openCodeImportIdentity(
  session: OpenCodeSessionSummary,
): Omit<AgentSessionImportSource, "provider" | "providerInstanceId" | "providerSessionId"> {
  return {
    filePath: openCodeSessionPath(session.databasePath, session.id),
    size: session.messageCount,
    mtimeMs: session.updatedAtMs,
    device: 0,
    inode: null,
    birthtimeMs: session.createdAtMs,
  };
}

/** Null when the session has no user message to start the thread from. */
export function openCodeSessionThread(input: {
  readonly session: OpenCodeSessionSummary;
  readonly contents: OpenCodeSessionContents;
  readonly providerInstanceId: ProviderInstanceId;
}): AgentSessionThread | null {
  const all: AgentSessionThreadMessage[] = input.contents.messages.map((message) => ({
    role: message.role,
    text: message.text,
    createdAt: iso(message.createdAtMs),
  }));
  const firstUser = all.find((message) => message.role === "user");
  if (firstUser === undefined) return null;
  const newest = all.slice(-MAX_OPENCODE_IMPORTED_MESSAGES);
  const messages = newest.includes(firstUser)
    ? newest
    : [firstUser, ...all.slice(-(MAX_OPENCODE_IMPORTED_MESSAGES - 1))];
  const sessionTitle = input.session.title.trim();
  const derivedTitle = firstUser.text.trim().split("\n")[0]?.slice(0, 100).trim() ?? "";
  const title =
    sessionTitle.length > 0 && !isPlaceholderOpenCodeTitle(sessionTitle)
      ? sessionTitle
      : derivedTitle.length > 0
        ? derivedTitle
        : "Imported thread";
  return {
    source: "opencode",
    providerInstanceId: input.providerInstanceId,
    providerSessionId: input.session.id,
    title,
    model: input.contents.model,
    createdAt: messages[0]?.createdAt ?? iso(input.session.createdAtMs),
    updatedAt: iso(input.session.updatedAtMs),
    messages,
  };
}
