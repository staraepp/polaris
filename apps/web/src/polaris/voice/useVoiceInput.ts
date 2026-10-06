import type { ClideDictationState } from "@t3tools/shared/polarisBridge";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPolarisBridge } from "../bridge";
import { MicCapture } from "./micCapture";
import { transcribeClip, type VoiceConfig } from "./voiceTranscribe";
import { encodeWav, VOICE_MIN_CLIP_MS } from "./wav";

export type VoicePhase = "idle" | "requesting" | "listening" | "transcribing";

export interface VoiceInput {
  readonly phase: VoicePhase;
  /** The last failure, cleared by the next start. */
  readonly error: string | null;
  /** Glow state: our own capture, or Clide dictating while Polaris has focus. */
  readonly glow: "listening" | "processing" | null;
  /** Latest 0–1 level, sampled by the glow each frame. */
  readonly level: () => number;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly cancel: () => void;
}

function micErrorMessage(cause: unknown): string {
  const name = typeof cause === "object" && cause !== null && "name" in cause ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was denied.";
  }
  if (name === "NotFoundError") return "No microphone was found.";
  return "The microphone could not start.";
}

/**
 * Push-to-talk state for the composer (Polaris). Records only between
 * `start` and `stop`, transcribes once, hands the text to `onTranscript`,
 * and keeps no audio afterwards. With Clide as the backend it also follows
 * Clide's own dictation so the composer glows while Clide listens.
 */
export function useVoiceInput(input: {
  readonly enabled: boolean;
  readonly config: VoiceConfig;
  readonly onTranscript: (text: string) => void;
}): VoiceInput {
  const { enabled, config, onTranscript } = input;
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clideState, setClideState] = useState<ClideDictationState>("idle");
  const captureRef = useRef<MicCapture | null>(null);
  const clideLevelRef = useRef(0);
  const configRef = useRef(config);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    configRef.current = config;
    onTranscriptRef.current = onTranscript;
  });

  const watchPort = enabled && config.backend === "clide" ? config.clidePort : 0;
  useEffect(() => {
    const voice = getPolarisBridge()?.voice;
    if (voice === undefined || watchPort <= 0) return;
    const unsubscribe = voice.onClideEvent((event) => {
      if (event.type === "level") clideLevelRef.current = event.level;
      else if (event.type === "state") setClideState(event.state);
      else if (event.status !== "connected") setClideState("idle");
    });
    void voice.watchClide(watchPort);
    return () => {
      unsubscribe();
      void voice.watchClide(null);
      setClideState("idle");
    };
  }, [watchPort]);

  useEffect(
    () => () => {
      void captureRef.current?.cancel();
      captureRef.current = null;
    },
    [],
  );

  const start = useCallback(async () => {
    if (captureRef.current !== null) return;
    setError(null);
    setPhase("requesting");
    const capture = new MicCapture();
    captureRef.current = capture;
    try {
      await capture.start();
      if (captureRef.current !== capture) {
        await capture.cancel();
        return;
      }
      setPhase("listening");
    } catch (cause) {
      await capture.cancel();
      if (captureRef.current === capture) captureRef.current = null;
      setError(micErrorMessage(cause));
      setPhase("idle");
    }
  }, []);

  const stop = useCallback(async () => {
    const capture = captureRef.current;
    if (capture === null) return;
    captureRef.current = null;
    const { samples, durationMs } = await capture.stop();
    if (durationMs < VOICE_MIN_CLIP_MS) {
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    const result = await transcribeClip(configRef.current, encodeWav(samples), {
      bridge: getPolarisBridge(),
      fetch: (url, init) => fetch(url, init),
    }).catch(() => ({
      ok: false as const,
      code: "network_error",
      message: "Transcription failed.",
    }));
    setPhase("idle");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const text = result.text.trim();
    if (text.length > 0) onTranscriptRef.current(text);
  }, []);

  const cancel = useCallback(() => {
    const capture = captureRef.current;
    captureRef.current = null;
    void capture?.cancel();
    setPhase("idle");
  }, []);

  const level = useCallback(() => captureRef.current?.level ?? clideLevelRef.current, []);

  const clideGlow =
    clideState === "recording" && document.hasFocus()
      ? "listening"
      : clideState === "transcribing" && document.hasFocus()
        ? "processing"
        : null;
  const glow =
    phase === "listening" ? "listening" : phase === "transcribing" ? "processing" : clideGlow;

  return { phase, error, glow, level, start, stop, cancel };
}
