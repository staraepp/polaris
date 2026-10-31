import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";

import * as ServerConfig from "../../config.ts";
import * as TailnetTrust from "./TailnetTrust.ts";
import type { TailnetPeer, TailnetSelf } from "./tailnetTrustDecision.ts";
import * as TailscaleIdentity from "./tailscaleIdentity.ts";

const self: TailnetSelf = {
  userId: "1930363337304003",
  loginName: "owner@example.com",
  magicDnsSuffix: "tail72660c.ts.net",
  magicDnsName: "brenos-mac-mini.tail72660c.ts.net",
  addresses: ["100.70.162.80"],
};

const ownPhone: TailnetPeer = {
  nodeName: "iphone174.tail72660c.ts.net",
  computedName: "iphone174",
  userId: self.userId,
  loginName: self.loginName,
};

const PHONE_ADDRESS = "100.88.67.96";

type WhoisAnswer = TailnetPeer | "fail" | "hang";

interface FakeCli {
  readonly calls: { status: number; whois: number };
  readonly layer: Layer.Layer<TailscaleIdentity.TailscaleIdentityCli>;
}

function fakeCli(input: {
  readonly self: TailnetSelf | null;
  readonly whois: WhoisAnswer;
}): FakeCli {
  const calls = { status: 0, whois: 0 };
  const layer = Layer.succeed(TailscaleIdentity.TailscaleIdentityCli, {
    readSelf: Effect.suspend(() => {
      calls.status += 1;
      return input.self === null
        ? Effect.fail(
            new TailscaleIdentity.TailnetCliError({ subcommand: "status", failure: "exit" }),
          )
        : Effect.succeed(input.self);
    }),
    whois: () =>
      Effect.suspend(() => {
        calls.whois += 1;
        if (input.whois === "hang") return Effect.never;
        if (input.whois === "fail") {
          return Effect.fail(
            new TailscaleIdentity.TailnetCliError({ subcommand: "whois", failure: "exit" }),
          );
        }
        return Effect.succeed(input.whois);
      }),
  });
  return { calls, layer };
}

function trustLayer(
  cli: FakeCli,
  settings: { readonly enabled: boolean; readonly serveEnabled?: boolean },
): Layer.Layer<TailnetTrust.TailnetTrust> {
  const configLayer = Layer.effect(
    ServerConfig.ServerConfig,
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      return {
        ...config,
        tailnetTrustEnabled: settings.enabled,
        tailnetTrustedNodeNames: [],
        tailscaleServeEnabled: settings.serveEnabled ?? false,
      } satisfies ServerConfig.ServerConfig["Service"];
    }),
  ).pipe(
    Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "t3-tailnet-trust-test-" })),
    Layer.provide(NodeServices.layer),
    Layer.orDie,
  );
  return TailnetTrust.layer.pipe(Layer.provide(cli.layer), Layer.provide(configLayer));
}

const directFrom = (peerAddress: string) => ({
  peerAddress,
  hostHeader: "100.70.162.80:3783",
  tailscaleUserLoginHeader: undefined,
  forwardedForHeader: undefined,
});

describe("TailnetTrust", () => {
  it.effect("trusts the owner's phone connecting over the tailnet", () => {
    const cli = fakeCli({ self, whois: ownPhone });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      const verdict = yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS));
      expect(verdict).toMatchObject({ trusted: true, via: "direct", computedName: "iphone174" });
      expect(cli.calls).toEqual({ status: 1, whois: 1 });
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("never asks Tailscale while the setting is off", () => {
    const cli = fakeCli({ self, whois: ownPhone });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      expect(trust.enabled).toBe(false);
      expect(yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS))).toEqual({
        trusted: false,
        reason: "disabled",
      });
      expect(cli.calls).toEqual({ status: 0, whois: 0 });
    }).pipe(Effect.provide(trustLayer(cli, { enabled: false })));
  });

  it.effect("denies a LAN address without starting tailscale", () => {
    const cli = fakeCli({ self, whois: ownPhone });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      expect(yield* trust.evaluateFacts(directFrom("192.168.1.44"))).toEqual({
        trusted: false,
        reason: "not-tailnet-address",
      });
      expect(cli.calls).toEqual({ status: 0, whois: 0 });
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("denies loopback with spoofed Serve headers when Serve is off", () => {
    const cli = fakeCli({ self, whois: ownPhone });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      const verdict = yield* trust.evaluateFacts({
        peerAddress: "127.0.0.1",
        hostHeader: "brenos-mac-mini.tail72660c.ts.net",
        tailscaleUserLoginHeader: self.loginName,
        forwardedForHeader: PHONE_ADDRESS,
      });
      expect(verdict).toEqual({ trusted: false, reason: "loopback-without-serve" });
      expect(cli.calls.whois).toBe(0);
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("denies when tailscale status fails", () => {
    const cli = fakeCli({ self: null, whois: ownPhone });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      expect(yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS))).toEqual({
        trusted: false,
        reason: "tailscale-unavailable",
      });
      expect(cli.calls.whois).toBe(0);
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("denies when whois fails and asks again next time", () => {
    const cli = fakeCli({ self, whois: "fail" });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      expect(yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS))).toEqual({
        trusted: false,
        reason: "whois-failed",
      });
      expect(yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS))).toEqual({
        trusted: false,
        reason: "whois-failed",
      });
      expect(cli.calls.whois).toBe(2);
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("denies when whois hangs past the deadline", () => {
    const cli = fakeCli({ self, whois: "hang" });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      const fiber = yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS)).pipe(Effect.forkScoped);
      yield* Effect.yieldNow;
      yield* TestClock.adjust(Duration.seconds(3));
      expect(yield* Fiber.join(fiber)).toEqual({ trusted: false, reason: "whois-failed" });
    }).pipe(Effect.scoped, Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("denies a node from another tailnet", () => {
    const cli = fakeCli({ self, whois: { ...ownPhone, nodeName: "phone.tail00000a.ts.net" } });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      expect(yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS))).toEqual({
        trusted: false,
        reason: "other-tailnet",
      });
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("caches a confirmed peer briefly, then asks Tailscale again", () => {
    const cli = fakeCli({ self, whois: ownPhone });
    return Effect.gen(function* () {
      const trust = yield* TailnetTrust.TailnetTrust;
      yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS));
      yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS));
      expect(cli.calls).toEqual({ status: 1, whois: 1 });

      yield* TestClock.adjust(Duration.seconds(31));
      yield* trust.evaluateFacts(directFrom(PHONE_ADDRESS));
      expect(cli.calls).toEqual({ status: 2, whois: 2 });
    }).pipe(Effect.provide(trustLayer(cli, { enabled: true })));
  });

  it.effect("reports this machine's tailnet addresses, or null without Tailscale", () =>
    Effect.gen(function* () {
      const up = yield* TailnetTrust.TailnetTrust.pipe(
        Effect.provide(trustLayer(fakeCli({ self, whois: ownPhone }), { enabled: true })),
      );
      expect(yield* up.ownAddresses).toEqual(["100.70.162.80"]);
      const down = yield* TailnetTrust.TailnetTrust.pipe(
        Effect.provide(trustLayer(fakeCli({ self: null, whois: ownPhone }), { enabled: true })),
      );
      expect(yield* down.ownAddresses).toBeNull();
    }),
  );
});
