import type { PolarisBridge } from "@t3tools/shared/polarisBridge";
import { describe, expect, it, vi } from "vite-plus/test";

import { transcribeClip, type VoiceConfig } from "./voiceTranscribe";

const wav = new Uint8Array([1, 2, 3]);
const config = (backend: VoiceConfig["backend"]): VoiceConfig => ({
  backend,
  clidePort: 4567,
  baseUrl: "http://localhost:8080/v1",
  model: "",
  language: "",
});

describe("transcribeClip", () => {
  it("goes through the desktop bridge when there is one", async () => {
    const transcribe = vi.fn(async () => ({ ok: true as const, text: "hi" }));
    const bridge = { voice: { transcribe } } as unknown as PolarisBridge;
    const fetchFn = vi.fn();
    await expect(transcribeClip(config("clide"), wav, { bridge, fetch: fetchFn })).resolves.toEqual(
      {
        ok: true,
        text: "hi",
      },
    );
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ backend: "clide", clidePort: 4567 }),
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("never calls Clide from a browser and posts to an OpenAI-compatible server directly", async () => {
    const fetchFn = vi.fn(
      async (_input: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );
    await expect(
      transcribeClip(config("clide"), wav, { bridge: undefined, fetch: fetchFn }),
    ).resolves.toMatchObject({ ok: false, code: "desktop_only" });
    expect(fetchFn).not.toHaveBeenCalled();
    await expect(
      transcribeClip(config("openaiCompatible"), wav, { bridge: undefined, fetch: fetchFn }),
    ).resolves.toEqual({ ok: true, text: "ok" });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://localhost:8080/v1/audio/transcriptions");
  });
});
