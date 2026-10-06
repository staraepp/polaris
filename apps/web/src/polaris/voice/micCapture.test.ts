import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("./pcmCapture.worklet.js?url", () => ({ default: "/pcm.js" }));

import { MicCapture } from "./micCapture";

describe("MicCapture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops a microphone that arrives after the capture was cancelled", async () => {
    const stopTrack = vi.fn();
    let grant: (stream: MediaStream) => void = () => {};
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: () =>
          new Promise<MediaStream>((resolve) => {
            grant = resolve;
          }),
      },
    });
    const audioContext = vi.fn();
    vi.stubGlobal("AudioContext", audioContext);

    const capture = new MicCapture();
    const started = capture.start();
    await capture.cancel();
    grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
    await started;

    expect(stopTrack).toHaveBeenCalledOnce();
    expect(audioContext).not.toHaveBeenCalled();
  });
});
