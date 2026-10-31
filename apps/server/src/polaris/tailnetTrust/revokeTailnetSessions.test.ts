import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentId } from "@t3tools/contracts";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TAILNET_TRUSTED_SESSION_SUBJECT } from "../../auth/EnvironmentAuth.ts";
import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as SessionStore from "../../auth/SessionStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import { revokeTailnetSessionsOnStartup } from "./revokeTailnetSessions.ts";

const layer = SessionStore.layer.pipe(
  Layer.provide(SqlitePersistenceMemory),
  Layer.provide(ServerSecretStore.layer),
  Layer.provide(
    Layer.succeed(ServerEnvironment.ServerEnvironmentIdentity, {
      getEnvironmentId: Effect.succeed(EnvironmentId.make("tailnet-revoke-test")),
    }),
  ),
  Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "polaris-revoke-test-" })),
  Layer.provide(NodeServices.layer),
);

it.effect("retires automatic sessions on restart while preserving paired sessions", () =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore.SessionStore;
    const automatic = yield* sessions.issue({
      method: "browser-session-cookie",
      subject: TAILNET_TRUSTED_SESSION_SUBJECT,
    });
    const paired = yield* sessions.issue({
      method: "browser-session-cookie",
      subject: "one-time-token",
    });
    expect(yield* revokeTailnetSessionsOnStartup).toBe(1);
    expect(yield* sessions.verify(automatic.token).pipe(Effect.isFailure)).toBe(true);
    expect((yield* sessions.verify(paired.token)).sessionId).toBe(paired.sessionId);
    expect(yield* revokeTailnetSessionsOnStartup).toBe(0);
  }).pipe(Effect.provide(layer)),
);
