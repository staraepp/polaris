/**
 * Polaris: how a browser tab coming back asks the connection to resume.
 *
 * Phone browsers suspend a hidden tab and often kill its websocket without a
 * close event. Probing that socket would show "Resuming" until the probe
 * times out, so after a long absence a phone reconnects at once, the same rule
 * the native mobile app uses. Desktop browsers keep probing, which leaves a
 * healthy socket alone.
 */
import type { Wakeups } from "@t3tools/client-runtime/connection";

export const PHONE_BACKGROUND_RECONNECT_AFTER_MS = 10_000;

export type WebResumeWakeup = Extract<
  Wakeups.ConnectionWakeup,
  "application-active" | "application-active-reconnect"
>;

export function webResumeWakeup(input: {
  readonly touchFirst: boolean;
  readonly hiddenAtMs: number | null;
  readonly visibleAtMs: number;
}): WebResumeWakeup {
  const longAbsence =
    input.hiddenAtMs !== null &&
    input.visibleAtMs - input.hiddenAtMs >= PHONE_BACKGROUND_RECONNECT_AFTER_MS;
  return input.touchFirst && longAbsence ? "application-active-reconnect" : "application-active";
}

/** A phone or tablet browser: touch input and no fine pointer. */
export function isTouchFirstBrowser(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const hasTouch = navigator.maxTouchPoints > 1;
  const coarseOnly = window.matchMedia?.("(pointer: coarse)").matches === true;
  return hasTouch && coarseOnly;
}
