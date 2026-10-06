// @effect-diagnostics nodeBuiltinImport:off globalFetch:off - drives the stub the way the desktop main process does: plain fetch and raw HTTP.
import * as NodeHttp from "node:http";

import {
  takeSseEvents,
  toClideLiveEvent,
  transcribeWithClide,
} from "@t3tools/shared/polarisVoiceHttp";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { CLIDE_STUB_TEXT, type ClideStub, startClideStub } from "./polaris-clide-stub.ts";

const stubs: ClideStub[] = [];
afterEach(async () => {
  await Promise.all(stubs.splice(0).map((stub) => stub.close()));
});

async function start(options: Parameters<typeof startClideStub>[0] = {}) {
  const stub = await startClideStub(options);
  stubs.push(stub);
  return stub;
}

/** A RIFF header is enough: the stub never decodes audio. */
const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

/** Raw request, so Host and Origin can be set the way `fetch` will not allow. */
function rawGet(port: number, path: string, headers: Record<string, string>) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = NodeHttp.request({ host: "127.0.0.1", port, path, headers }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => (body += chunk.toString()));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("polaris-clide-stub", () => {
  it("answers health with a version header and refuses a missing or wrong token", async () => {
    const stub = await start();
    expect(stub.token).toMatch(/^clide_[A-Za-z0-9_-]{43}$/);
    const base = `http://127.0.0.1:${stub.port}`;
    const ok = await fetch(`${base}/v1/health`, {
      headers: { Authorization: `Bearer ${stub.token}` },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-clide-version")).toContain("stub");
    expect(await ok.json()).toMatchObject({ ok: true, state: "idle" });

    expect((await fetch(`${base}/v1/health`)).status).toBe(401);
    const wrong = await fetch(`${base}/v1/health`, {
      headers: { Authorization: `Bearer ${stub.token}x` },
    });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({
      error: { code: "unauthorized", message: "Missing or wrong token." },
    });
  });

  it("blocks foreign Host headers (DNS rebinding) and any browser Origin", async () => {
    const stub = await start();
    const auth = { Authorization: `Bearer ${stub.token}` };
    const rebinding = await rawGet(stub.port, "/v1/health", { ...auth, Host: "evil.example" });
    expect(rebinding.status).toBe(403);
    expect(rebinding.body).toContain("forbidden_host");
    const fromPage = await rawGet(stub.port, "/v1/health", {
      ...auth,
      Host: `localhost:${stub.port}`,
      Origin: "https://evil.example",
    });
    expect(fromPage.status).toBe(403);
    expect(fromPage.body).toContain("forbidden_origin");
  });

  it("transcribes through Polaris's own Clide client, and refuses webm with the accepted list", async () => {
    const stub = await start();
    await expect(transcribeWithClide(fetch, stub, wav)).resolves.toEqual({
      ok: true,
      text: CLIDE_STUB_TEXT,
    });
    await expect(
      transcribeWithClide(fetch, { port: stub.port, token: "clide_nope" }, wav),
    ).resolves.toMatchObject({ ok: false, code: "unauthorized" });

    const form = new FormData();
    form.append("file", new Blob([wav], { type: "audio/webm" }), "clip.webm");
    const webm = await fetch(`http://127.0.0.1:${stub.port}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stub.token}` },
      body: form,
    });
    expect(webm.status).toBe(415);
    expect(await webm.json()).toMatchObject({
      error: { code: "unsupported_format", accepted: ["wav", "m4a", "mp3", "flac", "caf", "aiff"] },
    });
  });

  it("streams state on connect, then levels and a transcript through a dictation", async () => {
    const stub = await start();
    const base = `http://127.0.0.1:${stub.port}`;
    const auth = { Authorization: `Bearer ${stub.token}` };
    const controller = new AbortController();
    const response = await fetch(`${base}/v1/events`, {
      headers: { ...auth, Accept: "text/event-stream" },
      signal: controller.signal,
    });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const seen: string[] = [];
    let buffer = "";
    const readUntil = async (done: () => boolean) => {
      while (!done()) {
        const chunk = await reader.read();
        if (chunk.done) return;
        const split = takeSseEvents(buffer + decoder.decode(chunk.value, { stream: true }));
        buffer = split.rest;
        for (const { event, data } of split.events) {
          const live = toClideLiveEvent(event, data);
          seen.push(live?.type === "state" ? `state:${live.state}` : event);
        }
      }
    };

    await readUntil(() => seen.length > 0);
    expect(seen[0]).toBe("state:idle");
    expect(
      (await fetch(`${base}/v1/dictation/start`, { method: "POST", headers: auth })).status,
    ).toBe(200);
    await readUntil(() => seen.includes("level"));
    await fetch(`${base}/v1/dictation/stop`, { method: "POST", headers: auth });
    await readUntil(() => seen.at(-1) === "state:idle" && seen.includes("transcript"));
    controller.abort();

    expect(seen).toContain("state:recording");
    expect(seen.indexOf("state:transcribing")).toBeLessThan(seen.indexOf("transcript"));
  });
});
