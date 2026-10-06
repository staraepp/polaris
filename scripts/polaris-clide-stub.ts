// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off globalRandom:off - a dependency-free stub server, runnable with plain `node`, mirroring Clide's Rust server.
/**
 * A stub Clide Local API server (Polaris), built from `clide-api-spec.md`, so
 * voice can be developed and tested without Clide installed. It is NOT Clide:
 * every transcription returns the same fixed text and no audio is decoded.
 *
 *   node scripts/polaris-clide-stub.ts [--port 0] [--token clide_...] [--demo]
 *
 * Prints one JSON line `{ port, token }` (the token is made up for this run
 * unless you pass one), then serves until Ctrl-C. Put both in Polaris →
 * Settings → Voice → Clide. `--demo` loops a fake dictation (recording with
 * mic levels, transcribing, a transcript, idle) so the voice glow can be seen;
 * without it, `POST /v1/dictation/start|stop|toggle` drives one by hand.
 *
 * It keeps the spec's security rules: loopback only, a bearer token checked
 * by hash in constant time, Host and Origin checks, no CORS, a 25 MB upload
 * cap, a rate limit, and nothing logged about tokens, audio or text.
 */
import * as NodeCrypto from "node:crypto";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodeURL from "node:url";

export const CLIDE_STUB_VERSION = "1.0.0-polaris-stub";
export const CLIDE_STUB_TEXT = "This is the Polaris Clide stub. Nothing was transcribed.";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Multipart framing on top of the file itself. */
const UPLOAD_SLACK_BYTES = 64 * 1024;
const ACCEPTED_FORMATS = ["wav", "m4a", "mp3", "flac", "caf", "aiff"] as const;
const MAX_SUBSCRIBERS = 4;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_REQUESTS = 120;
const PING_EVERY_MS = 15_000;
const LEVEL_EVERY_MS = 33;

type ClideState = "idle" | "recording" | "transcribing" | "inserting" | "error";

export interface ClideStubOptions {
  /** 0 picks a free port. */
  readonly port?: number;
  /** Defaults to a fresh `clide_` token. */
  readonly token?: string;
  /** Loop a fake dictation every this many ms; off when unset. */
  readonly demoCycleMs?: number;
}

export interface ClideStub {
  readonly port: number;
  readonly token: string;
  readonly close: () => Promise<void>;
}

const sha256 = (value: string) => NodeCrypto.createHash("sha256").update(value).digest();

export function makeClideToken(): string {
  return `clide_${NodeCrypto.randomBytes(32).toString("base64url")}`;
}

function sendJson(response: NodeHttp.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function sendError(
  response: NodeHttp.ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(response, status, { error: { code, message } });
}

/** Reads the body up to `limit` bytes; null when it is larger. */
function readBody(request: NodeHttp.IncomingMessage, limit: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    request.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > limit) {
        over = true;
        chunks.length = 0;
        return;
      }
      if (!over) chunks.push(chunk);
    });
    request.on("end", () => resolve(over ? null : Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export function startClideStub(options: ClideStubOptions = {}): Promise<ClideStub> {
  const token = options.token ?? makeClideToken();
  // Like Clide, keep only the hash.
  const tokenHash = sha256(token);
  let port = 0;
  let state: ClideState = "idle";
  const subscribers = new Set<NodeHttp.ServerResponse>();
  const recentRequests: number[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let levelTimer: ReturnType<typeof setInterval> | null = null;

  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };

  const broadcast = (event: string, data: unknown) => {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const subscriber of subscribers) subscriber.write(frame);
  };

  const setState = (next: ClideState) => {
    state = next;
    broadcast("state", { state: next, ts: Date.now() });
  };

  const startRecording = () => {
    if (state !== "idle") return false;
    setState("recording");
    const startedAt = Date.now();
    levelTimer = setInterval(() => {
      // A speech-like wobble: two slow waves plus a little noise.
      const t = (Date.now() - startedAt) / 1000;
      const level = 0.35 + 0.3 * Math.sin(t * 5.1) * Math.sin(t * 1.3) + 0.15 * Math.random();
      broadcast("level", { level: Math.max(0, Math.min(1, level)), ts: Date.now() });
    }, LEVEL_EVERY_MS);
    return true;
  };

  const stopRecording = () => {
    if (state !== "recording") return false;
    if (levelTimer !== null) clearInterval(levelTimer);
    levelTimer = null;
    setState("transcribing");
    later(700, () => {
      broadcast("transcript", {
        id: `stub-${Date.now().toString(36)}`,
        text: CLIDE_STUB_TEXT,
        mode: "verbatim",
        engine: "polaris-stub",
      });
      setState("idle");
    });
    return true;
  };

  const demoCycle = (cycleMs: number) => {
    startRecording();
    later(Math.min(2_500, cycleMs / 2), stopRecording);
    later(cycleMs, () => demoCycle(cycleMs));
  };

  const authorized = (request: NodeHttp.IncomingMessage) => {
    const header = request.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) return false;
    return NodeCrypto.timingSafeEqual(sha256(header.slice(7)), tokenHash);
  };

  const rateLimited = () => {
    const now = Date.now();
    while (recentRequests.length > 0 && (recentRequests[0] ?? now) < now - RATE_WINDOW_MS) {
      recentRequests.shift();
    }
    recentRequests.push(now);
    return recentRequests.length > RATE_MAX_REQUESTS;
  };

  const handle = async (request: NodeHttp.IncomingMessage, response: NodeHttp.ServerResponse) => {
    response.setHeader("X-Clide-Version", CLIDE_STUB_VERSION);
    const host = request.headers.host ?? "";
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      return sendError(response, 403, "forbidden_host", "Bad Host header.");
    }
    // The stub's origin allowlist is always empty.
    if (request.headers.origin !== undefined) {
      return sendError(response, 403, "forbidden_origin", "Browser origins are not allowed.");
    }
    if (!authorized(request)) {
      return sendError(response, 401, "unauthorized", "Missing or wrong token.");
    }
    if (rateLimited()) {
      return sendError(response, 429, "rate_limited", "Too many requests.");
    }
    const path = new URL(request.url ?? "/", `http://127.0.0.1:${port}`).pathname;
    const method = request.method ?? "GET";

    if (method === "GET" && path === "/v1/health") {
      return sendJson(response, 200, {
        ok: true,
        version: CLIDE_STUB_VERSION,
        state,
        engine: "polaris-stub",
        mode: "verbatim",
      });
    }
    if (method === "GET" && path === "/v1/models") {
      return sendJson(response, 200, { data: [{ id: "polaris-stub", object: "model" }] });
    }
    if (method === "GET" && path === "/v1/events") {
      if (subscribers.size >= MAX_SUBSCRIBERS) {
        return sendError(response, 503, "busy", "Too many event subscribers.");
      }
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(`event: state\ndata: ${JSON.stringify({ state, ts: Date.now() })}\n\n`);
      subscribers.add(response);
      const ping = setInterval(() => response.write(": ping\n\n"), PING_EVERY_MS);
      request.on("close", () => {
        clearInterval(ping);
        subscribers.delete(response);
      });
      return;
    }
    if (method === "POST" && path === "/v1/audio/transcriptions") {
      const body = await readBody(request, MAX_UPLOAD_BYTES + UPLOAD_SLACK_BYTES);
      if (body === null) {
        return sendError(response, 413, "file_too_large", "The upload is over 25 MB.");
      }
      let form: FormData;
      try {
        form = await new Request(`http://127.0.0.1:${port}${path}`, {
          method: "POST",
          headers: { "content-type": request.headers["content-type"] ?? "" },
          body: new Uint8Array(body),
        }).formData();
      } catch {
        return sendError(response, 400, "bad_request", "Send multipart/form-data with a file.");
      }
      const file = form.get("file");
      if (!(file instanceof File)) {
        return sendError(response, 400, "bad_request", "The `file` field is required.");
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return sendError(response, 413, "file_too_large", "The upload is over 25 MB.");
      }
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(ACCEPTED_FORMATS as readonly string[]).includes(extension)) {
        return sendJson(response, 415, {
          error: {
            code: "unsupported_format",
            message: "Clide reads wav, m4a, mp3, flac, caf and aiff.",
            accepted: ACCEPTED_FORMATS,
          },
        });
      }
      if (form.get("response_format") === "text") {
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return response.end(CLIDE_STUB_TEXT);
      }
      return sendJson(response, 200, { text: CLIDE_STUB_TEXT });
    }
    const dictation = /^\/v1\/dictation\/(start|stop|toggle)$/.exec(path)?.[1];
    if (method === "POST" && dictation !== undefined) {
      const changed =
        dictation === "start"
          ? startRecording()
          : dictation === "stop"
            ? stopRecording()
            : startRecording() || stopRecording();
      return sendJson(response, changed ? 200 : 409, { ok: changed, state });
    }
    return sendError(response, 404, "not_found", "No such endpoint.");
  };

  const server: NodeHttp.Server = NodeHttp.createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) sendError(response, 500, "internal", "The stub failed.");
      else response.end();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Loopback only, never 0.0.0.0.
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      port = (server.address() as NodeNet.AddressInfo).port;
      if (options.demoCycleMs !== undefined) demoCycle(options.demoCycleMs);
      resolve({
        port,
        token,
        close: () =>
          new Promise<void>((done) => {
            for (const timer of timers) clearTimeout(timer);
            if (levelTimer !== null) clearInterval(levelTimer);
            for (const subscriber of subscribers) subscriber.end();
            subscribers.clear();
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}

function argValue(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

if (import.meta.url === NodeURL.pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const portArg = argValue(args, "--port");
  const tokenArg = argValue(args, "--token");
  const stub = await startClideStub({
    port: portArg === undefined ? 0 : Number(portArg),
    ...(tokenArg === undefined ? {} : { token: tokenArg }),
    ...(args.includes("--demo") ? { demoCycleMs: 6_000 } : {}),
  });
  // The one line a caller needs; the token is this run's, made up by the stub.
  process.stdout.write(`${JSON.stringify({ port: stub.port, token: stub.token })}\n`);
  const stop = () => void stub.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
