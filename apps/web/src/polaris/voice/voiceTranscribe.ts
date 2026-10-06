import type {
  PolarisBridge,
  VoiceBackend,
  VoiceTranscribeResult,
} from "@t3tools/shared/polarisBridge";
import { type FetchLike, transcribeOpenAiCompatible } from "@t3tools/shared/polarisVoiceHttp";

export interface VoiceConfig {
  readonly backend: VoiceBackend;
  readonly clidePort: number;
  readonly baseUrl: string;
  readonly model: string;
  readonly language: string;
}

/**
 * Sends a recorded clip to the configured backend (Polaris). On desktop the
 * main process does it, holding the secrets. In a browser only the
 * OpenAI-compatible route exists (Clide is desktop-only by its spec), with no
 * stored key, so it suits local servers that need none.
 */
export function transcribeClip(
  config: VoiceConfig,
  wav: Uint8Array,
  deps: { readonly bridge: PolarisBridge | undefined; readonly fetch: FetchLike },
): Promise<VoiceTranscribeResult> {
  const voice = deps.bridge?.voice;
  if (voice !== undefined) {
    return voice.transcribe({
      backend: config.backend,
      wav,
      clidePort: config.clidePort,
      baseUrl: config.baseUrl,
      model: config.model,
      language: config.language,
    });
  }
  if (config.backend === "clide") {
    return Promise.resolve({
      ok: false,
      code: "desktop_only",
      message: "Clide works through the Polaris desktop app.",
    });
  }
  return transcribeOpenAiCompatible(
    deps.fetch,
    { baseUrl: config.baseUrl, apiKey: null, model: config.model, language: config.language },
    wav,
  );
}
