// @effect-diagnostics globalTimers:off -- The Clide watcher's backoff timers are handed to it as plain functions.
// @effect-diagnostics globalFetch:off -- Voice clients call the user's own transcription servers from the main process.

import type {
  ClideLiveEvent,
  VoiceSecretKind,
  VoiceSecretsState,
  VoiceTranscribeRequest,
  VoiceTranscribeResult,
} from "@t3tools/shared/polarisBridge";
import { transcribeOpenAiCompatible, transcribeWithClide } from "@t3tools/shared/polarisVoiceHttp";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronSafeStorage from "../../electron/ElectronSafeStorage.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as IpcChannels from "../../ipc/channels.ts";
import { ClideEventWatcher } from "./ClideEventWatcher.ts";

const SECRET_KINDS: readonly VoiceSecretKind[] = ["clideToken", "openaiCompatibleKey"];

/** Each value is a `safeStorage` ciphertext, base64-encoded. */
const SecretsDocument = Schema.fromJsonString(
  Schema.Struct({
    clideToken: Schema.optional(Schema.String),
    openaiCompatibleKey: Schema.optional(Schema.String),
  }),
);
const decodeSecretsDocument = Schema.decodeUnknownEffect(SecretsDocument);
const encodeSecretsDocument = Schema.encodeEffect(SecretsDocument);

export class PolarisVoice extends Context.Service<
  PolarisVoice,
  {
    readonly getSecrets: Effect.Effect<VoiceSecretsState>;
    readonly setSecret: (kind: VoiceSecretKind, value: string) => Effect.Effect<VoiceSecretsState>;
    readonly clearSecret: (kind: VoiceSecretKind) => Effect.Effect<VoiceSecretsState>;
    readonly transcribe: (request: VoiceTranscribeRequest) => Effect.Effect<VoiceTranscribeResult>;
    readonly watchClide: (port: number | null) => Effect.Effect<void>;
  }
>()("@t3tools/desktop/polaris/voice/PolarisVoice") {}

/**
 * Voice for the desktop shell (Polaris). Secrets (Clide's token, an optional
 * key for an OpenAI-compatible server) are encrypted with `safeStorage` into
 * `polaris-voice-secrets.json` in the state dir; without `safeStorage` they
 * live in memory until quit. The renderer can store or clear a secret and ask
 * whether one is set, never read it back. Nothing here logs secrets, audio or
 * transcript text.
 */
export const make = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const safeStorage = yield* ElectronSafeStorage.ElectronSafeStorage;
  const windows = yield* ElectronWindow.ElectronWindow;
  const secretsPath = path.join(environment.stateDir, "polaris-voice-secrets.json");
  const runFork = Effect.runForkWith(yield* Effect.context<never>());

  const persistent = yield* safeStorage.isEncryptionAvailable.pipe(
    Effect.catch(() => Effect.succeed(false)),
  );
  const secrets = new Map<VoiceSecretKind, string>();

  if (persistent) {
    const stored = yield* fileSystem.readFileString(secretsPath).pipe(
      Effect.flatMap((raw) => decodeSecretsDocument(raw)),
      Effect.catch(() =>
        Effect.succeed({} as { clideToken?: string; openaiCompatibleKey?: string }),
      ),
    );
    for (const kind of SECRET_KINDS) {
      const encoded = stored[kind];
      if (typeof encoded !== "string") continue;
      const value = yield* Effect.fromResult(Encoding.decodeBase64(encoded)).pipe(
        Effect.flatMap((bytes) => safeStorage.decryptString(bytes)),
        Effect.catch(() => Effect.succeed<string | null>(null)),
      );
      if (value !== null && value.length > 0) secrets.set(kind, value);
    }
  }

  const persist = Effect.gen(function* () {
    if (!persistent) return;
    const document: { clideToken?: string; openaiCompatibleKey?: string } = {};
    for (const [kind, value] of secrets) {
      const encrypted = yield* safeStorage
        .encryptString(value)
        .pipe(Effect.catch(() => Effect.succeed<Uint8Array | null>(null)));
      if (encrypted !== null) document[kind] = Encoding.encodeBase64(encrypted);
    }
    const text = yield* encodeSecretsDocument(document).pipe(Effect.orDie);
    yield* fileSystem
      .writeFileString(secretsPath, `${text}\n`, { mode: 0o600 })
      .pipe(
        Effect.catch((error) =>
          Effect.logWarning("Could not save voice secrets.").pipe(
            Effect.annotateLogs({ reason: error.reason._tag }),
          ),
        ),
      );
  });

  const getSecrets = Effect.sync((): VoiceSecretsState => ({
    clideToken: secrets.has("clideToken"),
    openaiCompatibleKey: secrets.has("openaiCompatibleKey"),
    persistent,
  }));

  let clidePort: number | null = null;
  const watcher = new ClideEventWatcher({
    fetch: (input, init) => fetch(input, init),
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    onEvent: (event: ClideLiveEvent) => {
      runFork(windows.sendAll(IpcChannels.POLARIS_VOICE_CLIDE_EVENT_CHANNEL, event));
    },
  });
  yield* Effect.addFinalizer(() => Effect.sync(() => watcher.stop(false)));

  const syncWatcher = Effect.sync(() => {
    const token = secrets.get("clideToken");
    if (clidePort === null || token === undefined) watcher.stop(watcher.watching);
    else watcher.watch(clidePort, token);
  });

  const setSecret = Effect.fn("desktop.polaris.voice.setSecret")(function* (
    kind: VoiceSecretKind,
    value: string,
  ) {
    const trimmed = value.trim();
    if (trimmed.length === 0) secrets.delete(kind);
    else secrets.set(kind, trimmed);
    yield* persist;
    if (kind === "clideToken") yield* syncWatcher;
    return yield* getSecrets;
  });

  const clearSecret = (kind: VoiceSecretKind) => setSecret(kind, "");

  const transcribe = Effect.fn("desktop.polaris.voice.transcribe")(function* (
    request: VoiceTranscribeRequest,
  ) {
    const language = request.language?.trim() || undefined;
    if (request.backend === "clide") {
      const token = secrets.get("clideToken");
      if (token === undefined) {
        return {
          ok: false,
          code: "not_configured",
          message: "Paste Clide's Local API token in Settings.",
        } satisfies VoiceTranscribeResult;
      }
      return yield* Effect.promise(() =>
        transcribeWithClide(fetch, { port: request.clidePort ?? 0, token, language }, request.wav),
      );
    }
    return yield* Effect.promise(() =>
      transcribeOpenAiCompatible(
        fetch,
        {
          baseUrl: request.baseUrl ?? "",
          apiKey: secrets.get("openaiCompatibleKey") ?? null,
          model: request.model,
          language,
        },
        request.wav,
      ),
    );
  });

  const watchClide = (port: number | null) =>
    Effect.suspend(() => {
      clidePort = port;
      return syncWatcher;
    });

  return PolarisVoice.of({ getSecrets, setSecret, clearSecret, transcribe, watchClide });
});

export const layer = Layer.effect(PolarisVoice, make);
