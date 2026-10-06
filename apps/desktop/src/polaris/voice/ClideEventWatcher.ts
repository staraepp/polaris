import type { ClideLiveEvent } from "@t3tools/shared/polarisBridge";

import {
  clideBaseUrl,
  type FetchLike,
  isValidPort,
  takeSseEvents,
  toClideLiveEvent,
} from "@t3tools/shared/polarisVoiceHttp";

export const CLIDE_RECONNECT_MIN_MS = 1_000;
export const CLIDE_RECONNECT_MAX_MS = 30_000;

export interface ClideEventWatcherDeps {
  readonly fetch: FetchLike;
  readonly setTimer: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  readonly onEvent: (event: ClideLiveEvent) => void;
}

/**
 * Follows Clide's `/v1/events` stream (Polaris). Reconnects with backoff from
 * 1 s up to 30 s, as the spec asks; a rejected token stops it until `watch`
 * is called again (the user pasted a new one). One stream at a time.
 */
export class ClideEventWatcher {
  readonly #deps: ClideEventWatcherDeps;
  #target: { readonly port: number; readonly token: string } | null = null;
  #abort: AbortController | null = null;
  #timer: unknown = null;
  #delayMs = CLIDE_RECONNECT_MIN_MS;
  #generation = 0;

  constructor(deps: ClideEventWatcherDeps) {
    this.#deps = deps;
  }

  get watching(): boolean {
    return this.#target !== null;
  }

  watch(port: number, token: string): void {
    if (this.#target?.port === port && this.#target.token === token) return;
    this.stop(false);
    if (!isValidPort(port)) return;
    this.#target = { port, token };
    this.#delayMs = CLIDE_RECONNECT_MIN_MS;
    void this.#connect(this.#generation);
  }

  stop(announce = true): void {
    this.#generation += 1;
    this.#target = null;
    this.#abort?.abort();
    this.#abort = null;
    if (this.#timer !== null) this.#deps.clearTimer(this.#timer);
    this.#timer = null;
    if (announce) this.#deps.onEvent({ type: "connection", status: "stopped" });
  }

  async #connect(generation: number): Promise<void> {
    const target = this.#target;
    if (target === null || generation !== this.#generation) return;
    const abort = new AbortController();
    this.#abort = abort;
    try {
      const response = await this.#deps.fetch(`${clideBaseUrl(target.port)}/v1/events`, {
        headers: { Authorization: `Bearer ${target.token}`, Accept: "text/event-stream" },
        signal: abort.signal,
      });
      if (response.status === 401 || response.status === 403) {
        if (generation === this.#generation) {
          this.#target = null;
          this.#deps.onEvent({ type: "connection", status: "unauthorized" });
        }
        return;
      }
      if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status}`);
      this.#delayMs = CLIDE_RECONNECT_MIN_MS;
      this.#deps.onEvent({ type: "connection", status: "connected" });
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done || generation !== this.#generation) break;
        const taken = takeSseEvents(buffer + value);
        buffer = taken.rest;
        for (const { event, data } of taken.events) {
          const live = toClideLiveEvent(event, data);
          if (live !== null) this.#deps.onEvent(live);
        }
      }
    } catch {
      // Refused, dropped or aborted: retry below unless this watch ended.
    }
    if (generation !== this.#generation || this.#target === null) return;
    this.#deps.onEvent({ type: "state", state: "idle" });
    this.#deps.onEvent({ type: "connection", status: "reconnecting" });
    const delay = this.#delayMs;
    this.#delayMs = Math.min(CLIDE_RECONNECT_MAX_MS, this.#delayMs * 2);
    this.#timer = this.#deps.setTimer(() => {
      this.#timer = null;
      void this.#connect(generation);
    }, delay);
  }
}
