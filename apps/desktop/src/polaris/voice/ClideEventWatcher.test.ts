import { describe, expect, it, vi } from "vite-plus/test";

import { ClideEventWatcher, CLIDE_RECONNECT_MIN_MS } from "./ClideEventWatcher.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ClideEventWatcher", () => {
  it("forwards stream events and stops on a rejected token", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: state\ndata: {"state":"recording"}\n\n'));
        controller.enqueue(encoder.encode('event: level\ndata: {"level":0.5}\n\n'));
        controller.close();
      },
    });
    const events: unknown[] = [];
    const timers: { callback: () => void; delay: number }[] = [];
    const fetchFn = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(body, { status: 200 }))
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized" } }));
    const watcher = new ClideEventWatcher({
      fetch: fetchFn,
      setTimer: (callback, delay) => timers.push({ callback, delay }),
      clearTimer: () => {},
      onEvent: (event) => events.push(event),
    });
    watcher.watch(4567, "clide_x");
    await vi.waitFor(() => expect(timers).toHaveLength(1));
    expect(events).toEqual([
      { type: "connection", status: "connected" },
      { type: "state", state: "recording" },
      { type: "level", level: 0.5 },
      { type: "state", state: "idle" },
      { type: "connection", status: "reconnecting" },
    ]);
    expect(timers[0]?.delay).toBe(CLIDE_RECONNECT_MIN_MS);
    timers[0]?.callback();
    await vi.waitFor(() =>
      expect(events.at(-1)).toEqual({ type: "connection", status: "unauthorized" }),
    );
    expect(watcher.watching).toBe(false);
  });
});
