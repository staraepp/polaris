/**
 * Voice transcription clients (Polaris): Clide's
 * local API (`clide-api-spec.md`) and any OpenAI-compatible server. Plain
 * functions over an injected `fetch`. Clide is only ever called from the
 * desktop main process; the browser may use the OpenAI-compatible client.
 * Never log tokens, audio or transcript text.
 */
import type { ClideLiveEvent, VoiceTranscribeResult } from "./polarisBridge.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Clide's upload cap; larger clips are refused before sending. */
export const VOICE_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65_535;
}

/** Loopback only, by the spec's rule; `localhost` could resolve elsewhere. */
export function clideBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function failure(code: string, message: string): VoiceTranscribeResult {
  return { ok: false, code, message };
}

function isConnectionRefused(cause: unknown): boolean {
  const code =
    typeof cause === "object" && cause !== null && "cause" in cause
      ? (cause as { cause?: { code?: unknown } }).cause?.code
      : undefined;
  return code === "ECONNREFUSED";
}

async function readError(response: Response): Promise<{ code: string; message: string }> {
  const body: unknown = await response.json().catch(() => null);
  const error =
    typeof body === "object" && body !== null && "error" in body
      ? (body as { error?: { code?: unknown; message?: unknown } }).error
      : undefined;
  return {
    code: typeof error?.code === "string" ? error.code : `http_${response.status}`,
    message:
      typeof error?.message === "string"
        ? error.message
        : `The transcription server answered ${response.status}.`,
  };
}

async function postClip(
  fetchFn: FetchLike,
  url: string,
  token: string | null,
  wav: Uint8Array,
  fields: Readonly<Record<string, string | undefined>>,
  unreachable: VoiceTranscribeResult,
): Promise<VoiceTranscribeResult> {
  if (wav.byteLength === 0) return failure("empty_clip", "Nothing was recorded.");
  if (wav.byteLength > VOICE_MAX_UPLOAD_BYTES) {
    return failure("file_too_large", "The recording is longer than the 25 MB upload cap.");
  }
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "clip.wav");
  form.append("response_format", "json");
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value.length > 0) form.append(key, value);
  }
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: token === null ? {} : { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (cause) {
    return isConnectionRefused(cause)
      ? unreachable
      : failure("network_error", "Could not reach the transcription server.");
  }
  if (!response.ok) {
    const { code, message } = await readError(response);
    return failure(code, message);
  }
  const body: unknown = await response.json().catch(() => null);
  const text =
    typeof body === "object" && body !== null && "text" in body
      ? (body as { text?: unknown }).text
      : undefined;
  return typeof text === "string"
    ? { ok: true, text }
    : failure("bad_response", "The transcription server sent no text.");
}

export function transcribeWithClide(
  fetchFn: FetchLike,
  input: { readonly port: number; readonly token: string; readonly language?: string | undefined },
  wav: Uint8Array,
): Promise<VoiceTranscribeResult> {
  if (!isValidPort(input.port)) {
    return Promise.resolve(failure("not_configured", "Set Clide's Local API port in Settings."));
  }
  return postClip(
    fetchFn,
    `${clideBaseUrl(input.port)}/v1/audio/transcriptions`,
    input.token,
    wav,
    { language: input.language },
    failure("not_running", "Clide is not running, or its Local API is off."),
  );
}

/** `http(s)://host[:port]/v1`-style base; anything else is refused. */
export function openAiTranscriptionsUrl(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/audio/transcriptions`;
}

export function transcribeOpenAiCompatible(
  fetchFn: FetchLike,
  input: {
    readonly baseUrl: string;
    readonly apiKey: string | null;
    readonly model?: string | undefined;
    readonly language?: string | undefined;
  },
  wav: Uint8Array,
): Promise<VoiceTranscribeResult> {
  const url = openAiTranscriptionsUrl(input.baseUrl);
  if (url === null) {
    return Promise.resolve(
      failure("not_configured", "Set an http(s) transcription server URL in Settings."),
    );
  }
  return postClip(
    fetchFn,
    url,
    input.apiKey,
    wav,
    { model: input.model?.trim() || "whisper-1", language: input.language },
    failure("not_running", "The transcription server is not reachable."),
  );
}

/** Splits complete SSE blocks off `buffer`; comment lines (`: ping`) carry no data. */
export function takeSseEvents(buffer: string): {
  readonly events: readonly { readonly event: string; readonly data: string }[];
  readonly rest: string;
} {
  const events: { event: string; data: string }[] = [];
  let rest = buffer.replace(/\r\n/g, "\n");
  let index = rest.indexOf("\n\n");
  while (index !== -1) {
    const block = rest.slice(0, index);
    rest = rest.slice(index + 2);
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
    index = rest.indexOf("\n\n");
  }
  return { events, rest };
}

const CLIDE_STATES = new Set(["idle", "recording", "transcribing", "inserting", "error"]);

/** Clide's `state` and `level` events as bridge events; transcripts stay in Clide. */
export function toClideLiveEvent(event: string, data: string): ClideLiveEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (event === "state" && typeof record.state === "string" && CLIDE_STATES.has(record.state)) {
    return {
      type: "state",
      state: record.state as Extract<ClideLiveEvent, { type: "state" }>["state"],
    };
  }
  if (event === "level" && typeof record.level === "number" && Number.isFinite(record.level)) {
    return { type: "level", level: Math.max(0, Math.min(1, record.level)) };
  }
  return null;
}
