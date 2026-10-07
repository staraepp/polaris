// node:sqlite reads OpenCode's live databases read-only.
// @effect-diagnostics nodeBuiltinImport:off
/**
 * Polaris (V 5.4.0): OpenCode sessions for the session import. OpenCode keeps
 * every session in SQLite (`opencode.db`, plus `opencode-<channel>.db` for
 * other release channels) under its data directory: one `session` row per
 * session with the directory it ran in, `message` rows with the role and
 * model, and `part` rows holding the text. Older JSON stores are migrated into
 * the database by OpenCode itself, so only the databases are read.
 *
 * Read-only, with a short busy timeout so a running OpenCode never stalls the
 * scan. Sub-agent sessions (`parent_id`) and archived sessions are left out.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";

export interface OpenCodeSessionSummary {
  readonly databasePath: string;
  readonly id: string;
  readonly directory: string;
  readonly title: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly messageCount: number;
}

export interface OpenCodeSessionMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly createdAtMs: number;
}

export interface OpenCodeSessionContents {
  readonly messages: ReadonlyArray<OpenCodeSessionMessage>;
  /** `providerID/modelID`, the slug Polaris's OpenCode provider uses; the last one used wins. */
  readonly model: string | null;
}

/** A session reference that fits the import's per-file identity. */
export function openCodeSessionPath(databasePath: string, sessionId: string): string {
  return `${databasePath}#session/${sessionId}`;
}

/** The database and session id back out of `openCodeSessionPath`. */
export function parseOpenCodeSessionPath(
  path: string,
): { readonly databasePath: string; readonly sessionId: string } | null {
  const marker = path.lastIndexOf("#session/");
  if (marker <= 0) return null;
  const sessionId = path.slice(marker + "#session/".length);
  return sessionId.length > 0 ? { databasePath: path.slice(0, marker), sessionId } : null;
}

/** OpenCode's placeholder title before it names a session. */
export function isPlaceholderOpenCodeTitle(title: string): boolean {
  return /^New session\b/.test(title.trim());
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseJson(source: unknown): Record<string, unknown> {
  if (typeof source !== "string") return {};
  try {
    return record(JSON.parse(source));
  } catch {
    return {};
  }
}

function modelSlug(providerID: string, modelID: string): string | null {
  return providerID && modelID ? `${providerID}/${modelID}` : null;
}

/** The model a message names: assistants carry it flat, user messages under `model`. */
export function openCodeMessageModel(data: Record<string, unknown>): string | null {
  const flat = modelSlug(string(data.providerID), string(data.modelID));
  if (flat !== null) return flat;
  const nested = record(data.model);
  return modelSlug(string(nested.providerID), string(nested.modelID));
}

/** Visible text of a part: plain text the user or model wrote, not OpenCode's own insertions. */
export function openCodePartText(data: Record<string, unknown>): string {
  if (data.type !== "text" || data.synthetic === true || data.ignored === true) return "";
  return string(data.text);
}

/** `opencode.db` first, then the other channels' databases in name order. */
export function listOpenCodeDatabases(dataDirectory: string): string[] {
  let names: string[];
  try {
    names = NodeFS.readdirSync(dataDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^opencode(?:-[a-zA-Z0-9_-]*)?\.db$/.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  return names
    .toSorted((a, b) => (a === "opencode.db" ? -1 : b === "opencode.db" ? 1 : a.localeCompare(b)))
    .map((name) => NodePath.join(dataDirectory, name));
}

function openReadOnly(databasePath: string): NodeSqlite.DatabaseSync {
  const database = new NodeSqlite.DatabaseSync(databasePath, { readOnly: true });
  database.exec("PRAGMA busy_timeout = 100");
  return database;
}

function hasTables(database: NodeSqlite.DatabaseSync, names: readonly string[]): boolean {
  const tables = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name),
  );
  return names.every((name) => tables.has(name));
}

const SESSION_COLUMNS = `s.id, s.directory, s.title, s.time_created, s.time_updated,
  (SELECT count(*) FROM message m WHERE m.session_id = s.id) AS message_count`;

function sessionSummary(
  databasePath: string,
  row: Record<string, NodeSqlite.SQLOutputValue>,
): OpenCodeSessionSummary | null {
  const id = string(row.id);
  const directory = string(row.directory);
  const createdAtMs = number(row.time_created);
  const updatedAtMs = number(row.time_updated);
  if (!id || !directory || createdAtMs === null || updatedAtMs === null) return null;
  return {
    databasePath,
    id,
    directory,
    title: string(row.title),
    createdAtMs,
    updatedAtMs,
    messageCount: number(row.message_count) ?? 0,
  };
}

/**
 * Top-level, unarchived sessions of one database, newest first. Returns null
 * when the database cannot be read (busy, locked, or not an OpenCode store).
 */
export function listOpenCodeSessions(
  databasePath: string,
  limit: number,
): OpenCodeSessionSummary[] | null {
  let database: NodeSqlite.DatabaseSync | undefined;
  try {
    database = openReadOnly(databasePath);
    if (!hasTables(database, ["session", "message"])) return null;
    const rows = database
      .prepare(
        `SELECT ${SESSION_COLUMNS}
           FROM session s
          WHERE s.parent_id IS NULL AND s.time_archived IS NULL
          ORDER BY s.time_updated DESC, s.id ASC
          LIMIT ?`,
      )
      .all(limit);
    return rows.flatMap((row) => sessionSummary(databasePath, row) ?? []);
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

/** One top-level, unarchived session as it is now, or null (gone, archived, unreadable). */
export function getOpenCodeSession(
  databasePath: string,
  sessionId: string,
): OpenCodeSessionSummary | null {
  let database: NodeSqlite.DatabaseSync | undefined;
  try {
    database = openReadOnly(databasePath);
    if (!hasTables(database, ["session", "message"])) return null;
    const row = database
      .prepare(
        `SELECT ${SESSION_COLUMNS}
           FROM session s
          WHERE s.id = ? AND s.parent_id IS NULL AND s.time_archived IS NULL`,
      )
      .get(sessionId);
    return row === undefined ? null : sessionSummary(databasePath, row);
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

/**
 * One session's visible conversation, oldest first: each message's text parts
 * joined, empty messages (tool-only steps) dropped. Null when it cannot be read.
 */
export function readOpenCodeSession(
  databasePath: string,
  sessionId: string,
): OpenCodeSessionContents | null {
  let database: NodeSqlite.DatabaseSync | undefined;
  try {
    database = openReadOnly(databasePath);
    if (!hasTables(database, ["message", "part"])) return null;
    const textByMessage = new Map<string, string[]>();
    for (const row of database
      .prepare("SELECT message_id, data FROM part WHERE session_id = ? ORDER BY message_id, id")
      .iterate(sessionId)) {
      const text = openCodePartText(parseJson(row.data));
      if (text.length === 0) continue;
      const messageId = string(row.message_id);
      const texts = textByMessage.get(messageId);
      if (texts === undefined) textByMessage.set(messageId, [text]);
      else texts.push(text);
    }
    const messages: OpenCodeSessionMessage[] = [];
    let model: string | null = null;
    for (const row of database
      .prepare(
        "SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created, id",
      )
      .iterate(sessionId)) {
      const data = parseJson(row.data);
      const role = data.role;
      if (role !== "user" && role !== "assistant") continue;
      model = openCodeMessageModel(data) ?? model;
      const text = textByMessage.get(string(row.id))?.join("\n\n") ?? "";
      const createdAtMs = number(row.time_created);
      if (text.length === 0 || createdAtMs === null) continue;
      messages.push({ role, text, createdAtMs });
    }
    return { messages, model };
  } catch {
    return null;
  } finally {
    database?.close();
  }
}
