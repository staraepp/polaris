/**
 * Polaris "Trust my tailnet": on restart, recheck devices against the current
 * policy and allowlist. Ordinary paired sessions are untouched.
 * Runs once when the server starts, never from CLI commands, which do not
 * know the desktop app's setting.
 */
import * as Effect from "effect/Effect";

import { TAILNET_TRUSTED_SESSION_SUBJECT } from "../../auth/EnvironmentAuth.ts";
import * as SessionStore from "../../auth/SessionStore.ts";

export const revokeTailnetSessionsOnStartup = Effect.gen(function* () {
  const sessions = yield* SessionStore.SessionStore;
  const active = yield* sessions.listActive();
  const tailnetSessions = active.filter(
    (session) => session.subject === TAILNET_TRUSTED_SESSION_SUBJECT,
  );
  yield* Effect.forEach(tailnetSessions, (session) => sessions.revoke(session.sessionId), {
    discard: true,
  });
  if (tailnetSessions.length > 0) {
    yield* Effect.logInfo(
      "Revoked previous tailnet-trusted sessions; devices must be verified again.",
      {
        count: tailnetSessions.length,
      },
    );
  }
  return tailnetSessions.length;
}).pipe(Effect.withSpan("TailnetTrust.revokeSessionsOnStartup"));
