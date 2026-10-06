import { type PointerEvent, useRef } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { VoiceInput } from "./useVoiceInput";

/** Held longer than this, the press is push-to-talk; shorter, it toggles. */
const HOLD_MS = 350;

function MicGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <rect
        x="5.5"
        y="1.75"
        width="5"
        height="8"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M3.25 7.5a4.75 4.75 0 0 0 9.5 0M8 12.25v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PulseGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      {[4, 8, 12].map((x, index) => (
        <rect
          key={x}
          x={x - 0.75}
          y="5"
          width="1.5"
          height="6"
          rx="0.75"
          fill="currentColor"
          className="origin-center animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </svg>
  );
}

/**
 * Push-to-talk (Polaris): hold to talk and release to transcribe, or click
 * once to start and again to stop. Escape while listening throws it away.
 * Enter and Space toggle from the keyboard.
 */
export function VoiceButton({ voice }: { readonly voice: VoiceInput }) {
  const pressedAt = useRef<number | null>(null);
  const listening = voice.phase === "listening" || voice.phase === "requesting";
  const transcribing = voice.phase === "transcribing";
  const label = transcribing
    ? "Transcribing"
    : listening
      ? "Stop and transcribe"
      : "Voice input: hold to talk";

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || transcribing) return;
    event.preventDefault();
    if (listening) {
      pressedAt.current = null;
      void voice.stop();
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressedAt.current = performance.now();
    void voice.start();
  };

  const onPointerUp = () => {
    const startedAt = pressedAt.current;
    pressedAt.current = null;
    if (startedAt !== null && performance.now() - startedAt >= HOLD_MS) void voice.stop();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              aria-pressed={listening}
              disabled={transcribing}
              data-phase={voice.phase}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                pressedAt.current = null;
                voice.cancel();
              }}
              onClick={(event) => {
                // Pointer presses are handled above; this is Enter or Space.
                if (event.detail !== 0) return;
                if (listening) void voice.stop();
                else void voice.start();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && listening) {
                  event.preventDefault();
                  voice.cancel();
                }
              }}
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-progress motion-reduce:transition-none",
                listening &&
                  "bg-primary/14 text-primary-text hover:bg-primary/20 hover:text-primary-text",
                transcribing && "text-primary-text",
              )}
            />
          }
        >
          {transcribing ? <PulseGlyph /> : <MicGlyph />}
        </TooltipTrigger>
        <TooltipPopup>
          {voice.error ??
            (listening
              ? "Release or click to transcribe · Esc cancels"
              : "Hold to talk, or click to start")}
        </TooltipPopup>
      </Tooltip>
      <span className="sr-only" aria-live="polite">
        {voice.error ?? (listening ? "Listening" : transcribing ? "Transcribing" : "")}
      </span>
    </>
  );
}
