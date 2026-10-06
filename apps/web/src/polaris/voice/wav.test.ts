import { describe, expect, it } from "vite-plus/test";

import { chunkLevel, concatSamples, encodeWav } from "./wav";

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16-bit PCM header and clamps samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]));
    const view = new DataView(wav.buffer);
    const text = (offset: number, length: number) =>
      String.fromCharCode(...wav.slice(offset, offset + length));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((index) => view.getInt16(44 + index * 2, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });

  it("joins chunks and meters their level", () => {
    expect([...concatSamples([new Float32Array([1]), new Float32Array([2, 3])])]).toEqual([
      1, 2, 3,
    ]);
    expect(chunkLevel(new Float32Array())).toBe(0);
    expect(chunkLevel(new Float32Array([0.5, -0.5]))).toBe(1);
    expect(chunkLevel(new Float32Array([0.1, -0.1]))).toBeCloseTo(0.5);
  });
});
