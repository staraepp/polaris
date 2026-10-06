import type { UpdateInviteState } from "@t3tools/shared/polarisBridge";
import {
  normalizeInviteCode,
  POLARIS_INVITE_CODE_PATTERN,
} from "@t3tools/shared/polarisUpdateFeed";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronSafeStorage from "../../electron/ElectronSafeStorage.ts";
import { currentInviteCode, setCurrentInviteCode } from "./inviteCodeState.ts";

/** The code as a `safeStorage` ciphertext, base64-encoded. */
const InviteDocument = Schema.fromJsonString(Schema.Struct({ inviteCode: Schema.String }));
const decodeInviteDocument = Schema.decodeUnknownEffect(InviteDocument);
const encodeInviteDocument = Schema.encodeEffect(InviteDocument);

export class PolarisUpdateInvite extends Context.Service<
  PolarisUpdateInvite,
  {
    readonly getState: Effect.Effect<UpdateInviteState>;
    /** An empty value removes the code. A malformed one is refused, nothing changes. */
    readonly setCode: (value: string) => Effect.Effect<UpdateInviteState>;
  }
>()("@t3tools/desktop/polaris/updates/PolarisUpdateInvite") {}

/**
 * The user's invite code for the private update feed (Polaris, V 4.7.0).
 * Encrypted with `safeStorage` into `polaris-update-invite.json` in the state
 * dir; the renderer can set or clear it but never reads it back. Without
 * `safeStorage` the code lasts until the app quits.
 */
export const make = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const safeStorage = yield* ElectronSafeStorage.ElectronSafeStorage;
  const invitePath = path.join(environment.stateDir, "polaris-update-invite.json");

  const persistent = yield* safeStorage.isEncryptionAvailable.pipe(
    Effect.catch(() => Effect.succeed(false)),
  );

  if (persistent) {
    const stored = yield* fileSystem.readFileString(invitePath).pipe(
      Effect.flatMap((raw) => decodeInviteDocument(raw)),
      Effect.flatMap((document) => Effect.fromResult(Encoding.decodeBase64(document.inviteCode))),
      Effect.flatMap((bytes) => safeStorage.decryptString(bytes)),
      Effect.catch(() => Effect.succeed<string | null>(null)),
    );
    setCurrentInviteCode(stored);
  }

  const getState = Effect.sync((): UpdateInviteState => ({
    hasCode: currentInviteCode() !== null,
    persistent,
  }));

  const persist = Effect.gen(function* () {
    if (!persistent) return;
    const code = currentInviteCode();
    if (code === null) {
      yield* fileSystem.remove(invitePath, { force: true }).pipe(Effect.ignore);
      return;
    }
    const encrypted = yield* safeStorage
      .encryptString(code)
      .pipe(Effect.catch(() => Effect.succeed<Uint8Array | null>(null)));
    if (encrypted === null) return;
    const text = yield* encodeInviteDocument({
      inviteCode: Encoding.encodeBase64(encrypted),
    }).pipe(Effect.orDie);
    yield* fileSystem
      .writeFileString(invitePath, `${text}\n`, { mode: 0o600 })
      .pipe(
        Effect.catch((error) =>
          Effect.logWarning("Could not save the update invite code.").pipe(
            Effect.annotateLogs({ reason: error.reason._tag }),
          ),
        ),
      );
  });

  const setCode = (value: string) =>
    Effect.gen(function* () {
      const code = normalizeInviteCode(value);
      if (code.length > 0 && !POLARIS_INVITE_CODE_PATTERN.test(code)) return yield* getState;
      setCurrentInviteCode(code.length === 0 ? null : code);
      yield* persist;
      return yield* getState;
    });

  return PolarisUpdateInvite.of({ getState, setCode });
});

export const layer = Layer.effect(PolarisUpdateInvite, make);
