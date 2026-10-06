/** Sample rate Clide recommends; the AudioContext resamples the mic to it. */
export const VOICE_SAMPLE_RATE = 16_000;

/** Clips shorter than this are taps, not speech; they are discarded. */
export const VOICE_MIN_CLIP_MS = 300;

export function concatSamples(chunks: readonly Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return samples;
}

/** 16-bit PCM mono WAV, as `clide-api-spec.md` describes ("Make a WAV in the renderer"). */
export function encodeWav(samples: Float32Array, sampleRate = VOICE_SAMPLE_RATE): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** RMS of a chunk mapped to a 0–1 meter: speech sits around 0.3–0.8. */
export function chunkLevel(chunk: Float32Array): number {
  if (chunk.length === 0) return 0;
  let sum = 0;
  for (const sample of chunk) sum += sample * sample;
  return Math.min(1, Math.sqrt(sum / chunk.length) * 5);
}
