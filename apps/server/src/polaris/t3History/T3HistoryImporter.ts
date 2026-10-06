/**
 * T3HistoryImporter (Polaris): bring threads over from the T3 Code app on the
 * same computer.
 *
 * T3 Code 0.0.4x keeps everything in one V1 database
 * (`~/.t3/userdata/state.sqlite`). Polaris's own database carries the same V1
 * tables, and the legacy importer turns any V1 thread row without a V2 thread
 * into a thread (shell now, transcript when opened). So importing a project is:
 * read T3 Code's rows read-only, copy that project's threads, messages and
 * pull requests into Polaris's V1 tables under the Polaris project, then run
 * the legacy importer. Runtime state (sessions, approvals, auth) is never
 * copied, so Polaris cannot resume work T3 Code was doing. Threads Polaris
 * already has are skipped, so importing again only adds what is new.
 */
import * as NodeOS from "node:os";
import * as NodeSqlite from "node:sqlite";

import {
  PolarisT3HistoryError,
  type PolarisT3HistoryImportInput,
  type PolarisT3HistoryImportResult,
  type PolarisT3HistoryProject,
  type PolarisT3HistoryScanResult,
} from "@t3tools/contracts";
import { normalizeProjectPathForComparison } from "@t3tools/shared/path";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as ServerConfig from "../../config.ts";
import * as LegacyV1ThreadImporter from "../../orchestration-v2/legacy/LegacyV1ThreadImporter.ts";

/** The V1 tables the legacy importer reads. Nothing else is copied. */
const THREAD_TABLE = "projection_threads";
const CHILD_TABLES = ["projection_thread_messages", "projection_thread_pull_requests"] as const;
const REQUIRED_SOURCE_TABLES = ["projection_projects", THREAD_TABLE, CHILD_TABLES[0]];
/** Present only once a database has been through the V2 upgrade. */
const V2_MARKER_TABLE = "orchestration_v2_legacy_imports";

type SqlValue = NodeSqlite.SQLInputValue;
type SourceRow = Record<string, SqlValue>;

const readError = (cause: unknown) =>
  new PolarisT3HistoryError({ operation: "read-source", cause });

/** Opens T3 Code's database read-only for the duration of `use`. */
const withSource = <A>(sourcePath: string, use: (db: NodeSqlite.DatabaseSync) => A) =>
  Effect.acquireUseRelease(
    Effect.try({
      try: () => new NodeSqlite.DatabaseSync(sourcePath, { readOnly: true }),
      catch: readError,
    }),
    (db) => Effect.try({ try: () => use(db), catch: readError }),
    (db) => Effect.sync(() => db.close()),
  );

const sourceTables = (db: NodeSqlite.DatabaseSync) =>
  new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name)),
  );

const sourceColumns = (db: NodeSqlite.DatabaseSync, table: string) =>
  db
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .map((row) => String(row.name));

export interface T3HistoryImporterOptions {
  /** T3 Code's database. Defaults to `~/.t3/userdata/state.sqlite`. */
  readonly sourcePath?: string;
}

export const make = (options: T3HistoryImporterOptions = {}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const config = yield* ServerConfig.ServerConfig;
    const legacy = yield* LegacyV1ThreadImporter.LegacyV1ThreadImporter;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const sourcePath =
      options.sourcePath ?? path.join(NodeOS.homedir(), ".t3", "userdata", "state.sqlite");

    const realDirectory = (filePath: string) =>
      fs
        .realPath(path.dirname(filePath))
        .pipe(Effect.orElseSucceed(() => path.resolve(path.dirname(filePath))));
    const unavailableReason = Effect.gen(function* () {
      if (!(yield* fs.exists(sourcePath).pipe(Effect.orElseSucceed(() => false)))) {
        return "missing" as const;
      }
      if ((yield* realDirectory(sourcePath)) === (yield* realDirectory(config.dbPath))) {
        return "same-database" as const;
      }
      return null;
    });

    /** Thread ids Polaris already has, as V1 rows or as V2 threads. */
    const knownThreadIds = sql<{ readonly thread_id: string }>`
      SELECT thread_id FROM projection_threads
      UNION
      SELECT thread_id FROM orchestration_v2_projection_threads
    `.pipe(
      Effect.map((rows) => new Set(rows.map((row) => row.thread_id))),
      Effect.mapError((cause) => new PolarisT3HistoryError({ operation: "copy", cause })),
    );

    const scan = Effect.fn("polaris.t3History.scan")(function* () {
      const reason = yield* unavailableReason;
      if (reason !== null) {
        return { _tag: "unavailable", reason } satisfies PolarisT3HistoryScanResult;
      }
      const known = yield* knownThreadIds;
      const listed = yield* withSource(sourcePath, (db) => {
        const tables = sourceTables(db);
        if (
          tables.has(V2_MARKER_TABLE) ||
          REQUIRED_SOURCE_TABLES.some((table) => !tables.has(table))
        ) {
          return null;
        }
        const projectRows = db
          .prepare(
            `SELECT project_id, title, workspace_root FROM projection_projects
             WHERE deleted_at IS NULL`,
          )
          .all();
        const threadRows = db
          .prepare(
            `SELECT thread_id, project_id, updated_at FROM projection_threads
             WHERE deleted_at IS NULL`,
          )
          .all();
        return { projectRows, threadRows };
      });
      if (listed === null) {
        return { _tag: "unavailable", reason: "unsupported" } satisfies PolarisT3HistoryScanResult;
      }
      const byProject = new Map<
        string,
        { threadCount: number; importedThreadCount: number; lastActiveAt: string | null }
      >();
      for (const row of listed.threadRows) {
        const projectId = String(row.project_id);
        const entry = byProject.get(projectId) ?? {
          threadCount: 0,
          importedThreadCount: 0,
          lastActiveAt: null,
        };
        entry.threadCount += 1;
        if (known.has(String(row.thread_id))) entry.importedThreadCount += 1;
        const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
        if (updatedAt !== null && (entry.lastActiveAt === null || updatedAt > entry.lastActiveAt)) {
          entry.lastActiveAt = updatedAt;
        }
        byProject.set(projectId, entry);
      }
      const result: PolarisT3HistoryProject[] = [];
      for (const row of listed.projectRows) {
        const counts = byProject.get(String(row.project_id));
        const title = String(row.title ?? "").trim();
        const workspaceRoot = String(row.workspace_root ?? "").trim();
        if (counts === undefined || counts.threadCount === 0 || workspaceRoot === "") continue;
        result.push({
          sourceProjectId: String(row.project_id),
          title: title === "" ? path.basename(workspaceRoot) || workspaceRoot : title,
          workspaceRoot,
          threadCount: counts.threadCount,
          importedThreadCount: counts.importedThreadCount,
          lastActiveAt: counts.lastActiveAt,
        });
      }
      result.sort((left, right) =>
        (right.lastActiveAt ?? "").localeCompare(left.lastActiveAt ?? ""),
      );
      return { _tag: "available", projects: result } satisfies PolarisT3HistoryScanResult;
    });

    const targetColumns = (table: string) =>
      sql
        .unsafe<{ readonly name: string }>(`PRAGMA table_info("${table}")`)
        .pipe(Effect.map((rows) => new Set(rows.map((row) => row.name))));

    const insertRows = (table: string, columns: readonly string[], rows: readonly SourceRow[]) =>
      Effect.forEach(
        rows,
        (row) =>
          sql.unsafe(
            `INSERT OR IGNORE INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")})
             VALUES (${columns.map(() => "?").join(", ")})`,
            columns.map((column) => row[column] ?? null),
          ),
        { discard: true },
      );

    const importProject = Effect.fn("polaris.t3History.import")(function* (
      input: PolarisT3HistoryImportInput,
    ) {
      const reason = yield* unavailableReason;
      if (reason !== null) {
        return yield* new PolarisT3HistoryError({
          operation: "read-source",
          detail: `T3 Code history is not available (${reason}).`,
        });
      }
      const [project] = yield* sql<{ readonly workspace_root: string }>`
        SELECT workspace_root FROM projection_projects
        WHERE project_id = ${input.projectId} AND deleted_at IS NULL
      `.pipe(
        Effect.mapError((cause) => new PolarisT3HistoryError({ operation: "find-project", cause })),
      );
      if (project === undefined) {
        return yield* new PolarisT3HistoryError({
          operation: "find-project",
          detail: "The Polaris project for this folder no longer exists.",
        });
      }
      if (
        normalizeProjectPathForComparison(project.workspace_root) !==
        normalizeProjectPathForComparison(input.expectedWorkspaceRoot)
      ) {
        return yield* new PolarisT3HistoryError({
          operation: "find-project",
          detail: "The Polaris project moved to another folder. Look again before importing.",
        });
      }

      const known = yield* knownThreadIds;
      const copied = yield* withSource(sourcePath, (db) => {
        const threads = db
          .prepare(`SELECT * FROM projection_threads WHERE project_id = ? AND deleted_at IS NULL`)
          .all(input.sourceProjectId);
        const fresh = threads.filter((row) => !known.has(String(row.thread_id)));
        const tables = sourceTables(db);
        const children = CHILD_TABLES.filter((table) => tables.has(table)).map((table) => {
          const select = db.prepare(`SELECT * FROM "${table}" WHERE thread_id = ?`);
          return {
            table,
            columns: sourceColumns(db, table),
            rows: fresh.flatMap((thread) => select.all(thread.thread_id as SqlValue)),
          };
        });
        return {
          skippedCount: threads.length - fresh.length,
          threads: {
            table: THREAD_TABLE,
            columns: sourceColumns(db, THREAD_TABLE),
            rows: fresh.map((row) => ({ ...row, project_id: input.projectId })),
          },
          children,
        };
      });

      if (copied.threads.rows.length > 0) {
        yield* sql
          .withTransaction(
            Effect.gen(function* () {
              for (const { table, columns, rows } of [copied.threads, ...copied.children]) {
                const target = yield* targetColumns(table);
                const shared = columns.filter((column) => target.has(column));
                yield* insertRows(table, shared, rows as readonly SourceRow[]);
              }
            }),
          )
          .pipe(
            Effect.mapError((cause) => new PolarisT3HistoryError({ operation: "copy", cause })),
          );
        yield* legacy.reconcileShells.pipe(
          Effect.mapError((cause) => new PolarisT3HistoryError({ operation: "import", cause })),
        );
      }

      return {
        importedCount: copied.threads.rows.length,
        skippedCount: copied.skippedCount,
      } satisfies PolarisT3HistoryImportResult;
    });

    return { scan, importProject };
  });

type T3HistoryImporterShape = Effect.Success<ReturnType<typeof make>>;

export class T3HistoryImporter extends Context.Service<T3HistoryImporter, T3HistoryImporterShape>()(
  "t3/polaris/t3History/T3HistoryImporter",
) {}

export const layer = (options: T3HistoryImporterOptions = {}) =>
  Layer.effect(T3HistoryImporter, make(options));
