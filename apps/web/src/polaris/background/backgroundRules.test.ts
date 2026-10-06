import { describe, expect, it } from "vite-plus/test";

import {
  BACKGROUND_IMAGE_MAX_BYTES,
  BACKGROUND_VIDEO_MAX_BYTES,
  checkBackgroundFile,
  videoPlayback,
} from "./backgroundRules";

const MB = 1024 * 1024;

describe("checkBackgroundFile", () => {
  it("accepts still images and short videos by type", () => {
    expect(checkBackgroundFile({ type: "image/webp", size: 2 * MB })).toEqual({
      ok: true,
      kind: "image",
    });
    expect(checkBackgroundFile({ type: "VIDEO/MP4", size: 80 * MB })).toEqual({
      ok: true,
      kind: "video",
    });
  });

  it("refuses other types, empty files and files over the limits", () => {
    expect(checkBackgroundFile({ type: "image/svg+xml", size: 10 }).ok).toBe(false);
    expect(checkBackgroundFile({ type: "", size: 10 }).ok).toBe(false);
    expect(checkBackgroundFile({ type: "image/png", size: 0 })).toEqual({
      ok: false,
      message: "That file is empty.",
    });
    expect(
      checkBackgroundFile({ type: "image/png", size: BACKGROUND_IMAGE_MAX_BYTES + 1 }),
    ).toEqual({ ok: false, message: "That image is 25 MB; the limit is 25 MB." });
    expect(
      checkBackgroundFile({ type: "video/webm", size: BACKGROUND_VIDEO_MAX_BYTES + 50 * MB }),
    ).toEqual({ ok: false, message: "That video is 250 MB; the limit is 200 MB." });
  });
});

describe("videoPlayback", () => {
  const visible = {
    reducedMotion: false,
    pageHidden: false,
    windowFocused: true,
    battery: null,
  } as const;

  it("plays while visible and focused", () => {
    expect(videoPlayback(visible)).toEqual({ play: true });
    expect(videoPlayback({ ...visible, battery: { charging: false, level: 0.5 } })).toEqual({
      play: true,
    });
    expect(videoPlayback({ ...visible, battery: { charging: true, level: 0.05 } })).toEqual({
      play: true,
    });
  });

  it("holds still for reduced motion first, then hidden, unfocused and low battery", () => {
    expect(videoPlayback({ ...visible, reducedMotion: true, pageHidden: true })).toEqual({
      play: false,
      reason: "reduced-motion",
    });
    expect(videoPlayback({ ...visible, pageHidden: true })).toMatchObject({ reason: "hidden" });
    expect(videoPlayback({ ...visible, windowFocused: false })).toMatchObject({
      reason: "unfocused",
    });
    expect(videoPlayback({ ...visible, battery: { charging: false, level: 0.1 } })).toMatchObject({
      reason: "low-battery",
    });
  });
});
