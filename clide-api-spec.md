# clide-api-spec.md — Clide Local API v1

For the `clide_stt` repo (Tauri: Rust owns the mic, shortcut, transcription and insertion; React draws the window). Goal: let other local apps (first: Polaris) use Clide's transcription and show its live state, for example to drive a voice-reactive glow.

## Principles

- **Off by default.** Settings → Developer → "Local API" toggle.
- **Loopback only.** Bind `127.0.0.1` (never `0.0.0.0`). Audio and text never leave the machine, so the "no cloud" promise holds.
- **Standard where possible.** The transcription endpoint copies the OpenAI audio API shape, so any OpenAI-compatible client works.
- **Small.** v1 is three things: health, transcription, and an event stream. Remote control is optional (v1.1).

## Security (required, not optional)

A local HTTP server can be reached by any web page the user visits, so:

1. Bearer token on every request. **Storage decision: keep only a hash, never the token, and no Keychain.**
   - Generate 32 random bytes from the OS CSPRNG. Token format: `clide_` + base64url of those bytes (the prefix makes leaked tokens easy to spot and scan for).
   - Show the plaintext token **once**, in a dialog with a Copy button, when it is created or regenerated. Then forget it.
   - Persist only `SHA-256(token)` (hex) in the app's local settings store, file mode `0600`. A fast hash is correct here: the token is 256 bits of randomness, so a slow password hash adds nothing.
   - On each request, hash the presented token and compare to the stored hash in **constant time** (for example the `subtle` crate or `hmac`'s `verify_slice`). Never compare strings with `==`.
   - "Regenerate" replaces the hash and invalidates the old token immediately. Turning the API off closes the listener; the hash may stay. Lost token = regenerate.
   - Optional: store the last 4 characters as a non-secret hint to show in Settings.
   - Why not the Keychain: a verify-only token is not a recoverable secret, so there is nothing to protect with it. Keychain items are tied to the app's code signature, and unsigned or rebuilt dev binaries get re-prompted or denied. A hash has no such dev/release split.
2. Reject requests whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` (blocks DNS rebinding).
3. Reject any request with an `Origin` header unless the user added that origin to an allowlist (default: empty). Desktop clients should call from a main process, which sends no Origin.
4. No CORS headers by default.
5. Cap upload size (for example 25 MB) and request rate.
6. Never log tokens, audio, or transcript text.
7. Update the Privacy page: the only network activity stays model downloads, release checks and updates, plus an optional loopback server that is off by default.

## Endpoints

All under `http://127.0.0.1:<port>`. Header: `Authorization: Bearer <token>`. Every response carries `X-Clide-Version`.

### `GET /v1/health`

`{ "ok": true, "version": "2.0.0", "state": "idle", "engine": "whisper-large-v3-turbo-q5", "mode": "polished" }`

### `GET /v1/models`

OpenAI-style list of installed engines/models: `{ "data": [{ "id": "...", "object": "model" }] }`

### `POST /v1/audio/transcriptions`

`multipart/form-data`: `file` (required), `model` (optional; installed model id, default = current), `language` (optional), `response_format` (`json` default, or `text`).

**Accepted audio formats (decision):** whatever the macOS decoder reads: `wav`, `m4a`, `mp3`, `flac`, `caf`, `aiff`. Recommended input is 16 kHz mono 16-bit WAV. **`webm` / `ogg` / `opus` are NOT supported in v1.** They return `415` with a JSON body `{ "error": { "code": "unsupported_format", "message": "...", "accepted": ["wav","m4a","mp3","flac","caf","aiff"] } }`. No new decoder dependency and no bundled ffmpeg. Revisit only if a real client needs it (the lighter route would be a libopus adapter for Symphonia, not ffmpeg).
Returns `{ "text": "..." }`. Applies the user's current processing mode (Verbatim / Polished / Rewrite) unless `mode` is passed explicitly. Does NOT insert text into any app. Returns `503` with a clear error if no engine is installed, `413` if too large.

### `GET /v1/events` (Server-Sent Events)

Long-lived stream; clients use `fetch` with the bearer header. Events (`event:` name, JSON `data:`):

| event        | data                                                                                                  | when                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `state`      | `{ "state": "idle" \| "recording" \| "transcribing" \| "inserting" \| "error", "ts": 1735000000000 }` | on every change                                                |
| `level`      | `{ "level": 0.0–1.0, "ts": ... }`                                                                     | about 30 Hz while recording; the same meter the HUD pill shows |
| `partial`    | `{ "text": "..." }`                                                                                   | Apple Speech live typing only                                  |
| `transcript` | `{ "id": "...", "text": "...", "mode": "polished", "engine": "..." }`                                 | final text                                                     |
| `error`      | `{ "code": "...", "message": "..." }`                                                                 | failures                                                       |

Do not include the frontmost app name or window title in any event.

### Optional v1.1: `POST /v1/dictation/start | stop | toggle`

Body `{ "insert": false }` (default false for API-started sessions, so the text comes back in a `transcript` event instead of being typed into the focused app).

## Settings

Local API on/off · port (default pick one, make it configurable) · token (shown once on creation, then only a hash is kept; regenerate anytime) · allowed origins (empty) · toggles: transcription endpoint, event stream.

## Tests

- Unauthenticated, wrong-token, wrong-Host and unexpected-Origin requests are all rejected.
- The plaintext token never appears in the settings file, the database, or logs (grep for it after a run).
- Regenerating the token makes the old one fail immediately.
- A dev (unsigned) build works with no Keychain prompts.
- Server is unreachable from another machine (bind check).
- Transcription round trip with a short wav; `curl` example in docs.
- A webm/opus upload returns `415` with the `accepted` list.
- SSE emits `state` then `level` then `state` then `transcript` for one dictation.
- Toggling the setting off closes the listener immediately.

## Docs to update in the repo

Add a "Local API" page with the endpoints, a `curl` example, and the security notes above. Add a changelog entry. Update the Privacy page wording.

## How Polaris uses it (for reference; not part of Clide)

Polaris desktop's **main process** connects (keeps the token out of the renderer) and forwards events by IPC. It drives the `voice-glow` component like this:

| Clide                 | voice-glow                                                |
| --------------------- | --------------------------------------------------------- |
| `level` event         | `level={() => latestLevel}` (a getter sampled each frame) |
| `state: recording`    | `active` on                                               |
| `state: transcribing` | `processing={true}`                                       |
| `transcript`          | insert text into the composer                             |
| `state: idle`         | `active` off                                              |

## Using the API (client guide)

Audience: any agent or developer writing a client. The first client is Polaris desktop's main process. Read this before writing client code. (Implementers of the server: the "Server behavior" list below is a requirement.)

### Quick reference

| What                               | Call                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Is Clide up?                       | `GET /v1/health`                                                         |
| Installed models                   | `GET /v1/models`                                                         |
| Transcribe a finished clip         | `POST /v1/audio/transcriptions` (multipart; 16 kHz mono WAV recommended) |
| Live state, mic level, transcripts | `GET /v1/events` (Server-Sent Events)                                    |

Base URL: `http://127.0.0.1:<port>`. Every request needs `Authorization: Bearer <token>`. The port and token come from Clide → Settings → Developer → Local API; the token is shown **only once**, when it is created or regenerated.

### Try it with curl

```bash
export CLIDE_PORT=...   # from Settings
export CLIDE_TOKEN=clide_...

curl -s -H "Authorization: Bearer $CLIDE_TOKEN" http://127.0.0.1:$CLIDE_PORT/v1/health

curl -s -H "Authorization: Bearer $CLIDE_TOKEN" \
  -F file=@clip.wav -F response_format=json \
  http://127.0.0.1:$CLIDE_PORT/v1/audio/transcriptions

curl -N -H "Authorization: Bearer $CLIDE_TOKEN" -H "Accept: text/event-stream" \
  http://127.0.0.1:$CLIDE_PORT/v1/events
```

### Server behavior (requirements)

- `/v1/events` sends `Content-Type: text/event-stream` and `Cache-Control: no-cache`. Lines end with `\n`; a blank line ends an event.
- On connect it immediately sends the current `state` event.
- It sends a `: ping` comment line about every 15 seconds so clients can detect dead connections.
- `level` events flow only while recording (about 30 per second).
- It allows a few concurrent subscribers (for example 4).
- It closes all streams when the API is turned off or the token is regenerated.
- For OpenAI client compatibility: treat a `model` value it does not recognize (for example `whisper-1`) as "use the current model" instead of failing.

### Errors

All errors are JSON: `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | code                                  | Meaning                                                           |
| ---- | ------------------------------------- | ----------------------------------------------------------------- |
| 401  | `unauthorized`                        | Missing or wrong token                                            |
| 403  | `forbidden_host` / `forbidden_origin` | Bad `Host` or `Origin` header                                     |
| 413  | `file_too_large`                      | Upload over the size cap                                          |
| 415  | `unsupported_format`                  | Not wav, m4a, mp3, flac, caf or aiff. Includes an `accepted` list |
| 429  | `rate_limited`                        | Too many requests                                                 |
| 503  | `no_engine` / `busy`                  | No engine installed, or Clide is mid-dictation                    |

### Minimal TypeScript client (run it in Node or the Electron main process)

```ts
export type ClideEvent =
  | {
      event: "state";
      data: { state: "idle" | "recording" | "transcribing" | "inserting" | "error"; ts: number };
    }
  | { event: "level"; data: { level: number; ts: number } }
  | { event: "partial"; data: { text: string } }
  | { event: "transcript"; data: { id: string; text: string; mode: string; engine: string } }
  | { event: "error"; data: { code: string; message: string } };

export async function transcribe(base: string, token: string, wav: ArrayBuffer): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([wav], { type: "audio/wav" }), "clip.wav");
  form.append("response_format", "json");
  const res = await fetch(`${base}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.code ?? `HTTP ${res.status}`);
  }
  return (await res.json()).text as string;
}

export async function* clideEvents(
  base: string,
  token: string,
  signal?: AbortSignal,
): AsyncGenerator<ClideEvent> {
  const res = await fetch(`${base}/v1/events`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`clide events: HTTP ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) yield { event, data: JSON.parse(data.join("\n")) } as ClideEvent;
    }
  }
}
```

Comment lines (`: ping`) produce no `data:` and are skipped by the loop above.

### Make a WAV in the renderer

Do not upload `MediaRecorder` output; Chromium records WebM/Opus and Clide returns `415`. Instead:

1. Create `new AudioContext({ sampleRate: 16000 })` so the browser resamples for you.
2. Collect mono Float32 chunks with an `AudioWorklet`.
3. Concatenate, run `encodeWav`, and send the `ArrayBuffer` to the main process over IPC.
4. The main process calls `transcribe(...)`.

```ts
export function encodeWav(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
```

### Drive the glow

The main process forwards events over IPC. The renderer keeps the latest level in a ref and the current state in React state:

```tsx
const levelRef = useRef(0); // set from the "level" events
const [state, setState] = useState("idle"); // set from the "state" events

<VoiceBeam
  level={() => levelRef.current}
  active={state === "recording" || state === "transcribing"}
  processing={state === "transcribing"}
>
  <Composer />
</VoiceBeam>;
```

### OpenAI-compatible clients

Any client that speaks the OpenAI audio API can call the transcription endpoint:

```ts
import OpenAI from "openai";
const client = new OpenAI({ baseURL: `http://127.0.0.1:${port}/v1`, apiKey: token });
const { text } = await client.audio.transcriptions.create({ file, model: "whisper-1" });
```

### Rules for agents writing clients

- Call Clide only from a trusted process (the Electron main process), never from the renderer or a web page. Never log the token, audio, or transcript text.
- Treat `ECONNREFUSED` as "Clide is not running" and fall back to the browser-mic provider. Clide is macOS-only, so other OSes always use the fallback.
- If the event stream drops, reconnect with backoff (1 s up to 30 s). The first event after reconnecting is the current `state`.
- Handle `415` by telling the developer which formats are accepted. Do not retry.
- Treat transcript text as sensitive user data. Do not put it in Discord presence, telemetry, or error reports.
- Do not poll the REST endpoints for levels. Use the event stream.

## Non-goals

Remote or LAN access. Accounts. Cloud engines. Streaming raw audio out of Clide. Windows or Linux support (Clide is Apple Silicon, macOS 13+).
