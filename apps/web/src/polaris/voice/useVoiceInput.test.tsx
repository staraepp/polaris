// @vitest-environment jsdom
import type { ClideLiveEvent } from "@t3tools/shared/polarisBridge";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const capture = vi.hoisted(() => ({
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => ({ samples: new Float32Array(16_000), durationMs: 1000 })),
  cancel: vi.fn(async () => {}),
}));
vi.mock("./micCapture", () => ({
  MicCapture: class {
    level = 0.4;
    start = capture.start;
    stop = capture.stop;
    cancel = capture.cancel;
  },
}));

const bridge = vi.hoisted(() => {
  const listeners: ((event: ClideLiveEvent) => void)[] = [];
  return {
    listeners,
    voice: {
      transcribe: vi.fn(async () => ({ ok: true as const, text: "  hello world " })),
      watchClide: vi.fn(async () => {}),
      onClideEvent: (listener: (event: ClideLiveEvent) => void) => {
        listeners.push(listener);
        return () => listeners.splice(listeners.indexOf(listener), 1);
      },
    },
  };
});
vi.mock("../bridge", () => ({ getPolarisBridge: () => ({ voice: bridge.voice }) }));

const { useVoiceInput } = await import("./useVoiceInput");
type Voice = ReturnType<typeof useVoiceInput>;

describe("useVoiceInput", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  const latest: { voice?: Voice } = {};
  const onTranscript = vi.fn();

  function Probe({ port }: { readonly port: number }) {
    const voice = useVoiceInput({
      enabled: true,
      config: { backend: "clide", clidePort: port, baseUrl: "", model: "", language: "" },
      onTranscript,
    });
    useEffect(() => {
      latest.voice = voice;
    });
    return null;
  }
  const render = (port = 4567) => act(() => renderer.render(<Probe port={port} />));

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("records, transcribes once and hands over the trimmed text", async () => {
    await render();
    await act(() => latest.voice!.start());
    expect(latest.voice!.phase).toBe("listening");
    expect(latest.voice!.glow).toBe("listening");
    expect(latest.voice!.level()).toBe(0.4);
    await act(() => latest.voice!.stop());
    expect(bridge.voice.transcribe).toHaveBeenCalledOnce();
    expect(onTranscript).toHaveBeenCalledWith("hello world");
    expect(latest.voice!.phase).toBe("idle");
    expect(latest.voice!.glow).toBeNull();
  });

  it("drops a tap and reports a denied microphone", async () => {
    await render();
    capture.stop.mockResolvedValueOnce({ samples: new Float32Array(10), durationMs: 50 });
    await act(() => latest.voice!.start());
    await act(() => latest.voice!.stop());
    expect(bridge.voice.transcribe).not.toHaveBeenCalled();
    capture.start.mockRejectedValueOnce(
      Object.assign(new Error("no"), { name: "NotAllowedError" }),
    );
    await act(() => latest.voice!.start());
    expect(latest.voice!.error).toBe("Microphone access was denied.");
    expect(latest.voice!.phase).toBe("idle");
  });

  it("shows a transcription failure without inserting anything", async () => {
    await render();
    bridge.voice.transcribe.mockResolvedValueOnce({
      ok: false,
      code: "not_running",
      message: "Clide is not running.",
    } as never);
    await act(() => latest.voice!.start());
    await act(() => latest.voice!.stop());
    expect(latest.voice!.error).toBe("Clide is not running.");
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("follows Clide's own dictation for the glow", async () => {
    await render();
    expect(bridge.voice.watchClide).toHaveBeenCalledWith(4567);
    await act(() =>
      bridge.listeners.forEach((listener) => listener({ type: "state", state: "recording" })),
    );
    await act(() =>
      bridge.listeners.forEach((listener) => listener({ type: "level", level: 0.7 })),
    );
    expect(latest.voice!.glow).toBe("listening");
    expect(latest.voice!.level()).toBe(0.7);
    await act(() =>
      bridge.listeners.forEach((listener) => listener({ type: "state", state: "transcribing" })),
    );
    expect(latest.voice!.glow).toBe("processing");
    await render(0);
    expect(bridge.voice.watchClide).toHaveBeenLastCalledWith(null);
    expect(latest.voice!.glow).toBeNull();
  });
});
