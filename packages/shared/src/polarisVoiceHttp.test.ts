import { describe, expect, it, vi } from "vite-plus/test";

import {
  openAiTranscriptionsUrl,
  takeSseEvents,
  toClideLiveEvent,
  transcribeOpenAiCompatible,
  transcribeWithClide,
} from "./polarisVoiceHttp.ts";

const wav = new Uint8Array([82, 73, 70, 70]);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("transcribeWithClide", () => {
  it("posts the clip to the loopback API with the bearer token", async () => {
    const fetchFn = vi.fn(async () => json(200, { text: "hello there" }));
    const result = await transcribeWithClide(fetchFn, { port: 4567, token: "clide_x" }, wav);
    expect(result).toEqual({ ok: true, text: "hello there" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:4567/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: "Bearer clide_x" });
    expect((init.body as FormData).get("response_format")).toBe("json");
  });

  it("reports Clide's error codes and a refused connection as not running", async () => {
    const unsupported = await transcribeWithClide(
      async () => json(415, { error: { code: "unsupported_format", message: "wav only" } }),
      { port: 4567, token: "t" },
      wav,
    );
    expect(unsupported).toEqual({ ok: false, code: "unsupported_format", message: "wav only" });
    const refused = await transcribeWithClide(
      async () => {
        throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      },
      { port: 4567, token: "t" },
      wav,
    );
    expect(refused).toMatchObject({ ok: false, code: "not_running" });
    const unset = await transcribeWithClide(vi.fn(), { port: 0, token: "t" }, wav);
    expect(unset).toMatchObject({ ok: false, code: "not_configured" });
    const empty = await transcribeWithClide(vi.fn(), { port: 1, token: "t" }, new Uint8Array());
    expect(empty).toMatchObject({ ok: false, code: "empty_clip" });
  });
});

describe("transcribeOpenAiCompatible", () => {
  it("builds the endpoint from an http(s) base and refuses anything else", () => {
    expect(openAiTranscriptionsUrl("http://localhost:8080/v1/")).toBe(
      "http://localhost:8080/v1/audio/transcriptions",
    );
    expect(openAiTranscriptionsUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1/audio/transcriptions",
    );
    expect(openAiTranscriptionsUrl("file:///etc/passwd")).toBeNull();
    expect(openAiTranscriptionsUrl("https://user:pw@example.com/v1")).toBeNull();
    expect(openAiTranscriptionsUrl("not a url")).toBeNull();
  });

  it("sends the model and an optional key", async () => {
    const fetchFn = vi.fn(async () => json(200, { text: "ok" }));
    await transcribeOpenAiCompatible(
      fetchFn,
      { baseUrl: "http://localhost:8080/v1", apiKey: null, model: "", language: "pt" },
      wav,
    );
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({});
    expect((init.body as FormData).get("model")).toBe("whisper-1");
    expect((init.body as FormData).get("language")).toBe("pt");
  });
});

describe("Clide events", () => {
  it("parses SSE blocks across chunks and skips pings", () => {
    const first = takeSseEvents(
      'event: state\ndata: {"state":"recording","ts":1}\n\n: ping\n\nevent: le',
    );
    expect(first.events).toEqual([{ event: "state", data: '{"state":"recording","ts":1}' }]);
    const second = takeSseEvents(`${first.rest}vel\ndata: {"level":1.4}\n\n`);
    expect(second.events.map((event) => toClideLiveEvent(event.event, event.data))).toEqual([
      { type: "level", level: 1 },
    ]);
    expect(toClideLiveEvent("transcript", '{"text":"secret"}')).toBeNull();
  });
});
