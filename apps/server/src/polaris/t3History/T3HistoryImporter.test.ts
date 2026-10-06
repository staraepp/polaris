// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as ServerConfig from "../../config.ts";
import * as EventSink from "../../orchestration-v2/EventSink.ts";
import * as EventStore from "../../orchestration-v2/EventStore.ts";
import * as LegacyV1ThreadImporter from "../../orchestration-v2/legacy/LegacyV1ThreadImporter.ts";
import * as ProjectionStore from "../../orchestration-v2/ProjectionStore.ts";
import * as SqlitePersistence from "../../persistence/Layers/Sqlite.ts";
import { runMigrations } from "../../persistence/Migrations.ts";
import * as T3HistoryImporter from "./T3HistoryImporter.ts";

const AT = "2026-01-01T00:00:00.000Z";
const LATER = "2026-02-01T00:00:00.000Z";
const ROOT = "/tmp/polaris-t3-history-project";

/** A T3 Code 0.0.44 database: V1 schema (migration 54), one live and one deleted project. */
const seedT3Database = (sourcePath: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* runMigrations({ toMigrationInclusive: 54 });
    yield* sql`INSERT INTO projection_projects (project_id, title, workspace_root, scripts_json, created_at, updated_at)
      VALUES ('t3-project', 'Site', ${ROOT}, '[]', ${AT}, ${AT})`;
    yield* sql`INSERT INTO projection_projects (project_id, title, workspace_root, scripts_json, created_at, updated_at, deleted_at)
      VALUES ('t3-gone', 'Gone', '/tmp/gone', '[]', ${AT}, ${AT}, ${AT})`;
    for (const [threadId, title, deletedAt] of [
      ["t3-thread-1", "Fix the header", null],
      ["t3-thread-2", "Old idea", AT],
    ] as const) {
      yield* sql`INSERT INTO projection_threads (thread_id, project_id, title, model_selection_json, runtime_mode, interaction_mode, created_at, updated_at, deleted_at)
        VALUES (${threadId}, 't3-project', ${title}, '{"instanceId":"codex","model":"gpt-5.4"}', 'full-access', 'default', ${AT}, ${LATER}, ${deletedAt})`;
    }
    for (let index = 0; index < 4; index++) {
      yield* sql`INSERT INTO projection_thread_messages (message_id, thread_id, role, text, is_streaming, created_at, updated_at)
        VALUES (${`t3-message-${index}`}, 't3-thread-1', ${index % 2 ? "assistant" : "user"}, ${`Line ${index}`}, 0, ${`2026-01-0${index + 1}T00:00:00.000Z`}, ${`2026-01-0${index + 1}T00:00:00.000Z`})`;
    }
  }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: sourcePath })));

const withPolaris = <A, E>(
  directory: string,
  sourcePath: string,
  body: Effect.Effect<
    A,
    E,
    | SqlClient.SqlClient
    | ProjectionStore.ProjectionStoreV2
    | LegacyV1ThreadImporter.LegacyV1ThreadImporter
    | T3HistoryImporter.T3HistoryImporter
  >,
) =>
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    const configLayer = ServerConfig.layer({
      ...config,
      dbPath: NodePath.join(directory, "polaris", "userdata", "statev2.sqlite"),
    });
    const database = SqlitePersistence.layerConfig.pipe(Layer.provide(configLayer));
    const stores = Layer.mergeAll(EventStore.layer, ProjectionStore.layer).pipe(
      Layer.provideMerge(database),
    );
    const legacy = LegacyV1ThreadImporter.layer.pipe(
      Layer.provideMerge(Layer.mergeAll(stores, EventSink.layer.pipe(Layer.provide(stores)))),
    );
    const importer = T3HistoryImporter.layer({ sourcePath }).pipe(
      Layer.provideMerge(legacy),
      Layer.provide(configLayer),
    );
    return yield* body.pipe(Effect.provide(importer));
  }).pipe(
    Effect.provide(
      ServerConfig.layerTest(directory, directory).pipe(Layer.provideMerge(NodeServices.layer)),
    ),
  );

const tempDirectory = () =>
  NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "polaris-t3-history-"));

it.effect("copies a T3 Code project's threads into Polaris once, read-only", () => {
  const directory = tempDirectory();
  const sourcePath = NodePath.join(directory, "t3", "userdata", "state.sqlite");
  NodeFS.mkdirSync(NodePath.dirname(sourcePath), { recursive: true });
  return Effect.gen(function* () {
    yield* seedT3Database(sourcePath);
    const original = NodeFS.readFileSync(sourcePath);

    yield* withPolaris(
      directory,
      sourcePath,
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const importer = yield* T3HistoryImporter.T3HistoryImporter;
        yield* sql`INSERT INTO projection_projects (project_id, title, workspace_root, scripts_json, created_at, updated_at)
          VALUES ('polaris-project', 'Site', ${ROOT}, '[]', ${AT}, ${AT})`;

        const scanned = yield* importer.scan();
        assert.equal(scanned._tag, "available");
        if (scanned._tag !== "available") return;
        assert.deepEqual(scanned.projects, [
          {
            sourceProjectId: "t3-project",
            title: "Site",
            workspaceRoot: ROOT,
            threadCount: 1,
            importedThreadCount: 0,
            lastActiveAt: LATER,
          },
        ]);

        const input = {
          sourceProjectId: "t3-project",
          projectId: ProjectId.make("polaris-project"),
          expectedWorkspaceRoot: ROOT,
        };
        assert.deepEqual(yield* importer.importProject(input), {
          importedCount: 1,
          skippedCount: 0,
        });

        const threadId = ThreadId.make("t3-thread-1");
        const legacy = yield* LegacyV1ThreadImporter.LegacyV1ThreadImporter;
        yield* legacy.ensureTranscript(threadId);
        const projections = yield* ProjectionStore.ProjectionStoreV2;
        const thread = yield* projections.getThreadProjection(threadId);
        assert.equal(thread.thread.projectId, "polaris-project");
        assert.equal(thread.thread.title, "Fix the header");
        assert.deepEqual(
          thread.messages.map((message) => message.text),
          ["Line 0", "Line 1", "Line 2", "Line 3"],
        );

        // Running it again adds nothing and says so.
        assert.deepEqual(yield* importer.importProject(input), {
          importedCount: 0,
          skippedCount: 1,
        });
        const rescanned = yield* importer.scan();
        assert.equal(
          rescanned._tag === "available" ? rescanned.projects[0]?.importedThreadCount : -1,
          1,
        );

        // A project that moved folders is refused.
        const moved = yield* Effect.flip(
          importer.importProject({ ...input, expectedWorkspaceRoot: "/tmp/elsewhere" }),
        );
        assert.equal(moved.operation, "find-project");
      }),
    );

    assert.deepEqual(NodeFS.readFileSync(sourcePath), original);
  }).pipe(
    Effect.ensuring(Effect.sync(() => NodeFS.rmSync(directory, { recursive: true, force: true }))),
  );
});

it.effect("reports a missing T3 Code database and refuses its own database", () => {
  const directory = tempDirectory();
  return Effect.gen(function* () {
    const missing = yield* withPolaris(
      directory,
      NodePath.join(directory, "nowhere", "state.sqlite"),
      Effect.flatMap(T3HistoryImporter.T3HistoryImporter, (importer) => importer.scan()),
    );
    assert.deepEqual(missing, { _tag: "unavailable", reason: "missing" });

    const ownDirectory = NodePath.join(directory, "polaris", "userdata");
    NodeFS.mkdirSync(ownDirectory, { recursive: true });
    const sibling = NodePath.join(ownDirectory, "state.sqlite");
    NodeFS.writeFileSync(sibling, "");
    const same = yield* withPolaris(
      directory,
      sibling,
      Effect.flatMap(T3HistoryImporter.T3HistoryImporter, (importer) => importer.scan()),
    );
    assert.deepEqual(same, { _tag: "unavailable", reason: "same-database" });
  }).pipe(
    Effect.ensuring(Effect.sync(() => NodeFS.rmSync(directory, { recursive: true, force: true }))),
  );
});
