// node:net accepts sockets on the tailnet addresses for the main HTTP server.
// @effect-diagnostics nodeBuiltinImport:off
/**
 * Polaris "Trust my tailnet": with the setting on, the server's main listener
 * stays on loopback and these listeners add this machine's Tailscale
 * addresses, never 0.0.0.0, so the home LAN and public Wi-Fi cannot reach the
 * port at all.
 *
 * Each listener hands its sockets to the main Node HTTP server, so routes,
 * websockets, auth and shutdown are shared, and a socket accepted here keeps
 * the device's tailnet address as its remote address. The address list is
 * re-read every few seconds; a changed Tailscale address is re-bound.
 */
import type * as NodeHttp from "node:http";
import * as NodeNet from "node:net";

import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { HttpServer } from "effect/unstable/http";
import * as NetAddress from "effect/unstable/net/NetAddress";

import * as ServerConfig from "../../config.ts";
import { isTailnetAddress, normalizeIpAddress } from "./tailnetAddress.ts";
import * as TailnetTrust from "./TailnetTrust.ts";

const RECONCILE_INTERVAL = Duration.seconds(10);

/** The Node server behind the main listener; tailnet listeners hand it their sockets. */
export class PrimaryNodeHttpServer extends Context.Service<
  PrimaryNodeHttpServer,
  NodeHttp.Server
>()("t3/polaris/tailnetTrust/tailnetListeners/PrimaryNodeHttpServer") {}

export class TailnetListenError extends Schema.TaggedError<TailnetListenError>()(
  "TailnetListenError",
  {
    address: Schema.String,
    code: Schema.String,
  },
) {
  override get message(): string {
    return `Could not listen on ${this.address} (${this.code}).`;
  }
}

export interface TailnetListenerPlan {
  readonly open: ReadonlyArray<string>;
  readonly close: ReadonlyArray<string>;
}

/**
 * Which listeners to open and close. Only literal Tailscale addresses are ever
 * opened, whatever `tailscale status` reports.
 */
export function planTailnetListeners(
  current: ReadonlyArray<string>,
  reported: ReadonlyArray<string>,
): TailnetListenerPlan {
  const desired = new Set(reported.filter(isTailnetAddress).map(normalizeIpAddress));
  const existing = new Set(current);
  return {
    open: [...desired].filter((address) => !existing.has(address)).toSorted(),
    close: [...existing].filter((address) => !desired.has(address)).toSorted(),
  };
}

function errorCode(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" ? code : "UNKNOWN";
}

/** Listens on `host:port` and passes every accepted socket to `target`. */
export const listenForwarding = (
  target: NodeHttp.Server,
  host: string,
  port: number,
): Effect.Effect<NodeNet.Server, TailnetListenError> =>
  Effect.callback<NodeNet.Server, TailnetListenError>((resume) => {
    const listener = NodeNet.createServer((socket) => {
      target.emit("connection", socket);
    });
    const failBeforeListening = (error: unknown) => {
      listener.close();
      resume(Effect.fail(new TailnetListenError({ address: host, code: errorCode(error) })));
    };
    listener.once("error", failBeforeListening);
    listener.listen({ host, port, exclusive: true }, () => {
      listener.off("error", failBeforeListening);
      // A listening socket that errors later is replaced on the next pass;
      // an unhandled error event would end the process.
      listener.on("error", () => listener.close());
      resume(Effect.succeed(listener));
    });
  });

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    if (config.tailnetTrustEnabled !== true) return;

    const trust = yield* TailnetTrust.TailnetTrust;
    const target = yield* PrimaryNodeHttpServer;
    const server = yield* HttpServer.HttpServer;
    const address = server.address;
    if (NetAddress.isUnixPathAddress(address)) return;
    const port = address.port;

    const listeners = new Map<string, NodeNet.Server>();
    const lastFailure = new Map<string, string>();
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        for (const listener of listeners.values()) listener.close();
        listeners.clear();
      }),
    );

    const reconcile = Effect.gen(function* () {
      for (const [listening, listener] of listeners) {
        if (!listener.listening) listeners.delete(listening);
      }
      const reported = yield* trust.ownAddresses;
      // Tailscale could not be asked: keep what is open and try again later.
      if (reported === null) return;

      const plan = planTailnetListeners([...listeners.keys()], reported);
      for (const closing of plan.close) {
        listeners.get(closing)?.close();
        listeners.delete(closing);
        yield* Effect.logInfo("Stopped listening on a former tailnet address.", {
          address: closing,
        });
      }
      for (const opening of plan.open) {
        yield* listenForwarding(target, opening, port).pipe(
          Effect.tap((listener) =>
            Effect.sync(() => {
              listeners.set(opening, listener);
              lastFailure.delete(opening);
            }),
          ),
          Effect.tap(() => Effect.logInfo("Listening on the tailnet.", { address: opening, port })),
          Effect.catchTag("TailnetListenError", (error) => {
            const repeated = lastFailure.get(opening) === error.code;
            lastFailure.set(opening, error.code);
            return repeated
              ? Effect.void
              : Effect.logWarning("Could not listen on a tailnet address.", {
                  address: opening,
                  code: error.code,
                });
          }),
        );
      }
    });

    yield* reconcile.pipe(
      Effect.withSpan("TailnetListeners.reconcile"),
      Effect.repeat(Schedule.spaced(RECONCILE_INTERVAL)),
      Effect.forkScoped,
    );
  }),
);
