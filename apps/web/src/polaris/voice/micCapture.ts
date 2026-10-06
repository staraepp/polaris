import workletUrl from "./pcmCapture.worklet.js?url";
import { chunkLevel, concatSamples, VOICE_SAMPLE_RATE } from "./wav";

/**
 * Records the microphone as 16 kHz mono Float32 while voice input is held
 * (Polaris). An AudioWorklet does the capture; a ScriptProcessor takes over
 * where worklets are unavailable. Nothing is kept after `stop` or `cancel`.
 */
export class MicCapture {
  #stream: MediaStream | null = null;
  #context: AudioContext | null = null;
  #nodes: AudioNode[] = [];
  #chunks: Float32Array[] = [];
  #level = 0;

  /** Smoothed 0–1 input level, for the glow. */
  get level(): number {
    return this.#level;
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.#stream = stream;
    const context = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
    this.#context = context;
    const source = context.createMediaStreamSource(stream);
    // A muted sink keeps the graph pulling without playing the voice back.
    const sink = context.createGain();
    sink.gain.value = 0;
    sink.connect(context.destination);
    const onChunk = (chunk: Float32Array) => {
      this.#chunks.push(chunk);
      this.#level = Math.max(chunkLevel(chunk), this.#level * 0.82);
    };
    let capture: AudioNode;
    try {
      await context.audioWorklet.addModule(workletUrl);
      const node = new AudioWorkletNode(context, "polaris-pcm-capture");
      node.port.addEventListener("message", (event: MessageEvent<Float32Array>) =>
        onChunk(event.data),
      );
      node.port.start();
      capture = node;
    } catch {
      const node = context.createScriptProcessor(4096, 1, 1);
      node.addEventListener("audioprocess", (event) =>
        onChunk(new Float32Array(event.inputBuffer.getChannelData(0))),
      );
      capture = node;
    }
    source.connect(capture);
    capture.connect(sink);
    this.#nodes = [source, capture, sink];
  }

  /** Stops recording and returns what was captured. */
  async stop(): Promise<{ readonly samples: Float32Array; readonly durationMs: number }> {
    const samples = concatSamples(this.#chunks);
    await this.#release();
    return { samples, durationMs: (samples.length / VOICE_SAMPLE_RATE) * 1000 };
  }

  async cancel(): Promise<void> {
    await this.#release();
  }

  async #release(): Promise<void> {
    for (const node of this.#nodes) node.disconnect();
    this.#nodes = [];
    for (const track of this.#stream?.getTracks() ?? []) track.stop();
    this.#stream = null;
    const context = this.#context;
    this.#context = null;
    this.#chunks = [];
    this.#level = 0;
    await context?.close().catch(() => undefined);
  }
}
