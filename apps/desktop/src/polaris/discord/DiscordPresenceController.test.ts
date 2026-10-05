// @effect-diagnostics globalTimers:off -- A zero-delay setTimeout flushes the fake socket promises between steps.

import { assert, describe, it } from "@effect/vitest";

import { DISCORD_OP, DiscordFrameDecoder, encodeFrame, type DiscordFrame } from "./discordIpc.ts";
import {
  DiscordPresenceController,
  type DiscordConnection,
  type DiscordConnectionHandlers,
} from "./DiscordPresenceController.ts";

class FakeScheduler {
  #now = 0;
  #timers: { at: number; callback: () => void; id: number }[] = [];
  #nextId = 1;
  readonly setTimer = (callback: () => void, delayMs: number) => {
    const id = this.#nextId++;
    this.#timers.push({ at: this.#now + delayMs, callback, id });
    return id;
  };
  readonly clearTimer = (handle: unknown) => {
    this.#timers = this.#timers.filter((timer) => timer.id !== handle);
  };
  get pendingDelays(): number[] {
    return this.#timers.map((timer) => timer.at - this.#now).toSorted((a, b) => a - b);
  }
  async advance(ms: number): Promise<void> {
    const target = this.#now + ms;
    for (;;) {
      const next = this.#timers
        .filter((timer) => timer.at <= target)
        .toSorted((a, b) => a.at - b.at)[0];
      if (next === undefined) break;
      this.#timers = this.#timers.filter((timer) => timer.id !== next.id);
      this.#now = next.at;
      next.callback();
      await flush();
    }
    this.#now = target;
  }
}

class FakeConnection implements DiscordConnection {
  readonly frames: DiscordFrame[] = [];
  readonly #decoder = new DiscordFrameDecoder();
  ended = false;
  readonly handlers: DiscordConnectionHandlers;
  constructor(handlers: DiscordConnectionHandlers) {
    this.handlers = handlers;
  }
  write = (data: Uint8Array) => {
    this.frames.push(...this.#decoder.push(data));
  };
  end = () => {
    this.ended = true;
  };
  receive(op: (typeof DISCORD_OP)[keyof typeof DISCORD_OP], payload: unknown) {
    this.handlers.onData(encodeFrame(op, payload));
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function harness(options?: { listening?: ReadonlySet<string> }) {
  const scheduler = new FakeScheduler();
  const listening = options?.listening ?? new Set(["/tmp/discord-ipc-1"]);
  const attempts: string[] = [];
  const connections: FakeConnection[] = [];
  const logs: string[] = [];
  const controller = new DiscordPresenceController({
    clientId: "123456789012345678",
    socketPaths: ["/tmp/discord-ipc-0", "/tmp/discord-ipc-1"],
    connect: (path, handlers) => {
      attempts.push(path);
      if (!listening.has(path)) return Promise.reject(new Error("ECONNREFUSED"));
      const connection = new FakeConnection(handlers);
      connections.push(connection);
      return Promise.resolve(connection);
    },
    pid: 4242,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
    log: (message) => logs.push(message),
    initialRetryMs: 1_000,
    maxRetryMs: 4_000,
    readyTimeoutMs: 500,
  });
  return { scheduler, attempts, connections, controller, logs };
}

describe("DiscordPresenceController", () => {
  it("handshakes on the first listening socket and publishes the activity after READY", async () => {
    const { controller, attempts, connections, scheduler } = harness();
    controller.start(1_700_000_000_000);
    await flush();
    assert.deepStrictEqual(attempts, ["/tmp/discord-ipc-0", "/tmp/discord-ipc-1"]);
    const connection = connections[0]!;
    assert.deepStrictEqual(connection.frames, [
      { op: DISCORD_OP.HANDSHAKE, payload: { v: 1, client_id: "123456789012345678" } },
    ]);
    assert.strictEqual(controller.status, "connecting");

    connection.receive(DISCORD_OP.FRAME, { cmd: "DISPATCH", evt: "READY", data: {} });
    assert.strictEqual(controller.status, "connected");
    assert.deepStrictEqual(connection.frames[1], {
      op: DISCORD_OP.FRAME,
      payload: {
        cmd: "SET_ACTIVITY",
        args: {
          pid: 4242,
          activity: {
            details: "Coding with Polaris",
            timestamps: { start: 1_700_000_000_000 },
            assets: { large_image: "polaris", large_text: "Polaris" },
            instance: false,
          },
        },
        nonce: "polaris-1",
      },
    });
  });

  it("stays quiet and backs off while Discord is not running, then connects when it appears", async () => {
    const listening = new Set<string>();
    const { controller, attempts, scheduler, connections, logs } = harness({ listening });
    controller.start(1_700_000_000_000);
    await flush();
    assert.strictEqual(controller.status, "waiting");
    assert.deepStrictEqual(scheduler.pendingDelays, [1_000]);
    await scheduler.advance(1_000);
    assert.deepStrictEqual(scheduler.pendingDelays, [2_000]);
    await scheduler.advance(2_000);
    assert.deepStrictEqual(scheduler.pendingDelays, [4_000]);
    await scheduler.advance(4_000);
    assert.deepStrictEqual(scheduler.pendingDelays, [4_000], "capped at maxRetryMs");
    assert.strictEqual(attempts.length, 8);
    assert.deepStrictEqual(logs, [], "absence of Discord is not an error");

    listening.add("/tmp/discord-ipc-0");
    await scheduler.advance(4_000);
    assert.strictEqual(connections.length, 1);
    connections[0]!.receive(DISCORD_OP.FRAME, { evt: "READY" });
    assert.strictEqual(controller.status, "connected");
  });

  it("answers pings and reconnects after Discord closes the socket", async () => {
    const { controller, connections, scheduler } = harness();
    controller.start(1_700_000_000_000);
    await flush();
    const first = connections[0]!;
    first.receive(DISCORD_OP.FRAME, { evt: "READY" });
    first.receive(DISCORD_OP.PING, { ts: 7 });
    assert.deepStrictEqual(first.frames.at(-1), { op: DISCORD_OP.PONG, payload: { ts: 7 } });

    first.handlers.onClose();
    assert.strictEqual(controller.status, "waiting");
    await scheduler.advance(1_000);
    assert.strictEqual(connections.length, 2);
    assert.strictEqual(connections[1]!.frames[0]!.op, DISCORD_OP.HANDSHAKE);
  });

  it("gives up on a silent handshake and retries", async () => {
    const { controller, connections, scheduler, logs } = harness();
    controller.start(1_700_000_000_000);
    await flush();
    await scheduler.advance(500);
    assert.isTrue(connections[0]!.ended);
    assert.strictEqual(controller.status, "waiting");
    assert.strictEqual(logs.length, 1);
    await scheduler.advance(1_000);
    assert.strictEqual(connections.length, 2);
  });

  it("clears the activity and stops retrying when switched off", async () => {
    const { controller, connections, scheduler } = harness();
    controller.start(1_700_000_000_000);
    await flush();
    const connection = connections[0]!;
    connection.receive(DISCORD_OP.FRAME, { evt: "READY" });
    controller.stop();
    assert.strictEqual(controller.status, "stopped");
    assert.isTrue(connection.ended);
    assert.deepStrictEqual(connection.frames.at(-1), {
      op: DISCORD_OP.FRAME,
      payload: { cmd: "SET_ACTIVITY", args: { pid: 4242 }, nonce: "polaris-2" },
    });
    assert.deepStrictEqual(scheduler.pendingDelays, []);
    connection.handlers.onClose();
    await scheduler.advance(10_000);
    assert.strictEqual(connections.length, 1, "no reconnect after stop");
    controller.start(1_700_000_000_000);
    await flush();
    assert.strictEqual(connections.length, 2, "start works again after stop");
  });
});
