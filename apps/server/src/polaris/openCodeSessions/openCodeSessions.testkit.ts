// node:sqlite writes OpenCode-shaped test databases.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";

export interface SeedOpenCodeSession {
  readonly id: string;
  readonly directory?: string;
  readonly title?: string;
  readonly parentId?: string;
  readonly archived?: boolean;
  readonly updated?: number;
  readonly messages?: ReadonlyArray<{
    readonly id: string;
    readonly at: number;
    readonly data: Record<string, unknown>;
    readonly parts: ReadonlyArray<Record<string, unknown>>;
  }>;
}

/** The subset of OpenCode's schema the import reads. */
export function seedOpenCodeDatabase(
  path: string,
  sessions: ReadonlyArray<SeedOpenCodeSession>,
): void {
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  const database = new NodeSqlite.DatabaseSync(path);
  database.exec(`
    CREATE TABLE session (
      id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL,
      directory text NOT NULL, title text NOT NULL, version text NOT NULL,
      time_created integer NOT NULL, time_updated integer NOT NULL, time_archived integer
    );
    CREATE TABLE message (
      id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL,
      time_updated integer NOT NULL, data text NOT NULL
    );
    CREATE TABLE part (
      id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL,
      time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL
    );
  `);
  const insertSession = database.prepare(
    "INSERT INTO session VALUES (?, 'project', ?, 'slug', ?, ?, '1.0.0', 1000, ?, ?)",
  );
  const insertMessage = database.prepare("INSERT INTO message VALUES (?, ?, ?, ?, ?)");
  const insertPart = database.prepare("INSERT INTO part VALUES (?, ?, ?, ?, ?, ?)");
  for (const session of sessions) {
    insertSession.run(
      session.id,
      session.parentId ?? null,
      session.directory ?? "/work/app",
      session.title ?? "A session",
      session.updated ?? 2000,
      session.archived === true ? 3000 : null,
    );
    for (const message of session.messages ?? []) {
      insertMessage.run(
        message.id,
        session.id,
        message.at,
        message.at,
        JSON.stringify(message.data),
      );
      message.parts.forEach((part, index) => {
        insertPart.run(
          `${message.id}_part_${index}`,
          message.id,
          session.id,
          message.at,
          message.at,
          JSON.stringify(part),
        );
      });
    }
  }
  database.close();
}
