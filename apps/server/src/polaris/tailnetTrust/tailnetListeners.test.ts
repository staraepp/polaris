// A real Node HTTP server and a real forwarding listener on loopback.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";

import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { listenForwarding, planTailnetListeners } from "./tailnetListeners.ts";

describe("planTailnetListeners", () => {
  it("opens every reported tailnet address on first run", () => {
    expect(planTailnetListeners([], ["100.70.162.80", "fd7a:115c:a1e0::e92b:a251"])).toEqual({
      open: ["100.70.162.80", "fd7a:115c:a1e0::e92b:a251"],
      close: [],
    });
  });

  it("re-binds when the Tailscale address changes", () => {
    expect(planTailnetListeners(["100.70.162.80"], ["100.101.5.9"])).toEqual({
      open: ["100.101.5.9"],
      close: ["100.70.162.80"],
    });
  });

  it("keeps listeners that are still reported", () => {
    expect(planTailnetListeners(["100.70.162.80"], ["100.70.162.80"])).toEqual({
      open: [],
      close: [],
    });
  });

  it("never opens a non-tailnet address, whatever Tailscale reports", () => {
    expect(
      planTailnetListeners([], ["0.0.0.0", "::", "192.168.1.20", "127.0.0.1", "100.70.162.80"]),
    ).toEqual({ open: ["100.70.162.80"], close: [] });
  });

  it("closes everything when Tailscale reports no addresses", () => {
    expect(planTailnetListeners(["100.70.162.80"], [])).toEqual({
      open: [],
      close: ["100.70.162.80"],
    });
  });
});

const getVia = (port: number) =>
  Effect.callback<string>((resume) => {
    NodeHttp.get({ host: "127.0.0.1", port, path: "/who" }, (response) => {
      let body = "";
      response.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
      response.on("end", () => resume(Effect.succeed(body)));
    }).on("error", (error) => resume(Effect.die(error)));
  });

describe("listenForwarding", () => {
  it.live("hands accepted sockets to the main server with the client's address intact", () =>
    Effect.gen(function* () {
      const target = NodeHttp.createServer((request, response) => {
        response.end(`${request.url} from ${request.socket.remoteAddress}`);
      });
      yield* Effect.addFinalizer(() => Effect.sync(() => target.close()));

      const listener = yield* listenForwarding(target, "127.0.0.1", 0);
      yield* Effect.addFinalizer(() => Effect.sync(() => listener.close()));
      const port = (listener.address() as NodeNet.AddressInfo).port;

      // The main server itself never listened; the request only reached it
      // through the forwarding listener.
      expect(target.listening).toBe(false);
      expect(yield* getVia(port)).toBe("/who from 127.0.0.1");
    }).pipe(Effect.scoped),
  );

  it.live("fails with the socket error code when the port is taken", () =>
    Effect.gen(function* () {
      const target = NodeHttp.createServer();
      const first = yield* listenForwarding(target, "127.0.0.1", 0);
      yield* Effect.addFinalizer(() => Effect.sync(() => first.close()));
      const port = (first.address() as NodeNet.AddressInfo).port;

      const error = yield* listenForwarding(target, "127.0.0.1", port).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "TailnetListenError", code: "EADDRINUSE" });
    }).pipe(Effect.scoped),
  );
});
