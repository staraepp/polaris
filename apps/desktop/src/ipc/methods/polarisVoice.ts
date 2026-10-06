import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as PolarisVoice from "../../polaris/voice/PolarisVoice.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

const VoiceSecretsStateSchema = Schema.Struct({
  clideToken: Schema.Boolean,
  openaiCompatibleKey: Schema.Boolean,
  persistent: Schema.Boolean,
});

const VoiceSecretKindSchema = Schema.Literals(["clideToken", "openaiCompatibleKey"]);

const VoiceTranscribeResultSchema = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), text: Schema.String }),
  Schema.Struct({ ok: Schema.Literal(false), code: Schema.String, message: Schema.String }),
]);

export const getVoiceSecrets = makeIpcMethod({
  channel: IpcChannels.POLARIS_VOICE_GET_SECRETS_CHANNEL,
  payload: Schema.Void,
  result: VoiceSecretsStateSchema,
  handler: Effect.fn("desktop.ipc.polaris.voice.getSecrets")(function* () {
    return yield* (yield* PolarisVoice.PolarisVoice).getSecrets;
  }),
});

/** An empty value clears the secret. */
export const setVoiceSecret = makeIpcMethod({
  channel: IpcChannels.POLARIS_VOICE_SET_SECRET_CHANNEL,
  payload: Schema.Struct({ kind: VoiceSecretKindSchema, value: Schema.String }),
  result: VoiceSecretsStateSchema,
  handler: Effect.fn("desktop.ipc.polaris.voice.setSecret")(function* ({ kind, value }) {
    return yield* (yield* PolarisVoice.PolarisVoice).setSecret(kind, value);
  }),
});

export const transcribeVoice = makeIpcMethod({
  channel: IpcChannels.POLARIS_VOICE_TRANSCRIBE_CHANNEL,
  payload: Schema.Struct({
    backend: Schema.Literals(["clide", "openaiCompatible"]),
    wav: Schema.Uint8Array,
    clidePort: Schema.optional(Schema.Number),
    baseUrl: Schema.optional(Schema.String),
    model: Schema.optional(Schema.String),
    language: Schema.optional(Schema.String),
  }),
  result: VoiceTranscribeResultSchema,
  handler: Effect.fn("desktop.ipc.polaris.voice.transcribe")(function* (request) {
    return yield* (yield* PolarisVoice.PolarisVoice).transcribe(request);
  }),
});

export const watchClideEvents = makeIpcMethod({
  channel: IpcChannels.POLARIS_VOICE_WATCH_CLIDE_CHANNEL,
  payload: Schema.NullOr(Schema.Number),
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.polaris.voice.watchClide")(function* (port) {
    yield* (yield* PolarisVoice.PolarisVoice).watchClide(port);
  }),
});
