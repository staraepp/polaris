/**
 * Polaris "Trust my tailnet": decides whether an HTTP request comes from one
 * of the owner's tailnet devices. Never fails: anything it cannot confirm
 * (Tailscale down, whois slow or failing, unknown node) is a denial, and the
 * caller falls back to pairing.
 *
 * Only confirmed answers are cached, briefly. A failure is never remembered,
 * so a device that Tailscale stops vouching for is denied on its next request.
 */
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type { HttpServerRequest } from "effect/unstable/http";

import { serveProxyGate } from "./serveProxy.ts";

import * as ServerConfig from "../../config.ts";
import { readRequestPeerAddress } from "../../auth/utils.ts";
import {
  judgeTailnetPeer,
  selectTailnetCandidate,
  type TailnetPeer,
  type TailnetRequestFacts,
  type TailnetSelf,
  type TailnetTrustVerdict,
} from "./tailnetTrustDecision.ts";
import * as TailscaleIdentity from "./tailscaleIdentity.ts";

const SELF_CACHE_MS = 30_000;
const PEER_CACHE_MS = 30_000;
// Above the CLI's own whois timeout: a hung lookup is a denial either way.
const WHOIS_DEADLINE = Duration.seconds(3);

function headerValue(
  request: HttpServerRequest.HttpServerRequest,
  name: string,
): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

/** The facts the decision may use: the socket address and three headers, nothing else. */
export function requestFacts(
  request: HttpServerRequest.HttpServerRequest,
  input: { readonly enabled: boolean; readonly serveEnabled: boolean },
): TailnetRequestFacts {
  return {
    enabled: input.enabled,
    serveEnabled: input.serveEnabled,
    peerAddress: readRequestPeerAddress(request),
    verifiedServeProxy: serveProxyGate.isVerified(request.source),
    hostHeader: headerValue(request, "host"),
    tailscaleUserLoginHeader: headerValue(request, "tailscale-user-login"),
    forwardedForHeader: headerValue(request, "x-forwarded-for"),
  };
}

export class TailnetTrust extends Context.Service<
  TailnetTrust,
  {
    readonly enabled: boolean;
    readonly evaluate: (
      request: HttpServerRequest.HttpServerRequest,
    ) => Effect.Effect<TailnetTrustVerdict>;
    /** The same decision from already-extracted facts (`requestFacts`). */
    readonly evaluateFacts: (
      facts: Omit<TailnetRequestFacts, "enabled" | "serveEnabled">,
    ) => Effect.Effect<TailnetTrustVerdict>;
    /** This machine's Tailscale addresses right now; null when Tailscale cannot be asked. */
    readonly ownAddresses: Effect.Effect<ReadonlyArray<string> | null>;
  }
>()("t3/polaris/tailnetTrust/TailnetTrust") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const cli = yield* TailscaleIdentity.TailscaleIdentityCli;
  const enabled = config.tailnetTrustEnabled === true;
  const allowedNodeNames = config.tailnetTrustedNodeNames ?? [];
  const selfCache = yield* Ref.make<{ readonly self: TailnetSelf; readonly at: number } | null>(
    null,
  );
  const peerCache = yield* Ref.make<
    ReadonlyMap<string, { readonly peer: TailnetPeer; readonly at: number }>
  >(new Map());

  const readSelf = (maxAgeMs: number): Effect.Effect<TailnetSelf | null> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const cached = yield* Ref.get(selfCache);
      if (cached !== null && now - cached.at < maxAgeMs) return cached.self;
      return yield* cli.readSelf.pipe(
        Effect.tap((self) => Ref.set(selfCache, { self, at: now })),
        Effect.catch(() => Ref.set(selfCache, null).pipe(Effect.as(null))),
      );
    });

  const whois = (address: string): Effect.Effect<TailnetPeer | null> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const cached = (yield* Ref.get(peerCache)).get(address);
      if (cached !== undefined && now - cached.at < PEER_CACHE_MS) return cached.peer;
      return yield* cli.whois(address).pipe(
        Effect.timeoutOrElse({
          duration: WHOIS_DEADLINE,
          orElse: () =>
            Effect.fail(
              new TailscaleIdentity.TailnetCliError({ subcommand: "whois", failure: "timeout" }),
            ),
        }),
        Effect.tap((peer) =>
          Ref.update(peerCache, (entries) => {
            const next = new Map(entries);
            next.set(address, { peer, at: now });
            return next;
          }),
        ),
        Effect.catch(() =>
          Ref.update(peerCache, (entries) => {
            const next = new Map(entries);
            next.delete(address);
            return next;
          }).pipe(Effect.as(null)),
        ),
      );
    });

  const evaluateFacts = (
    input: Omit<TailnetRequestFacts, "enabled" | "serveEnabled">,
  ): Effect.Effect<TailnetTrustVerdict> =>
    Effect.gen(function* () {
      if (!enabled) return { trusted: false, reason: "disabled" } as const;
      const facts: TailnetRequestFacts = {
        ...input,
        enabled,
        serveEnabled: config.tailscaleServeEnabled,
      };
      // Decide what can be decided without Tailscale first, so LAN and other
      // off-tailnet requests never start a tailscale process.
      const firstPass = selectTailnetCandidate(facts, null);
      const needsSelf = firstPass.ok || firstPass.reason === "tailscale-unavailable";
      if (!needsSelf) return { trusted: false, reason: firstPass.reason } as const;

      const self = yield* readSelf(SELF_CACHE_MS);
      if (self === null) return { trusted: false, reason: "tailscale-unavailable" } as const;
      const selection = firstPass.ok ? firstPass : selectTailnetCandidate(facts, self);
      if (!selection.ok) return { trusted: false, reason: selection.reason } as const;

      const peer = yield* whois(selection.candidate.peerAddress);
      if (peer === null) return { trusted: false, reason: "whois-failed" } as const;
      return judgeTailnetPeer({ candidate: selection.candidate, self, peer, allowedNodeNames });
    }).pipe(Effect.withSpan("TailnetTrust.evaluate"));

  const evaluate = (
    request: HttpServerRequest.HttpServerRequest,
  ): Effect.Effect<TailnetTrustVerdict> =>
    evaluateFacts(requestFacts(request, { enabled, serveEnabled: config.tailscaleServeEnabled }));

  return TailnetTrust.of({
    enabled,
    evaluate,
    evaluateFacts,
    ownAddresses: readSelf(0).pipe(Effect.map((self) => self?.addresses ?? null)),
  });
});

export const layer = Layer.effect(TailnetTrust, make);
