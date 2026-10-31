// node:http sends Host and the Serve headers exactly as given; fetch may not.
// @effect-diagnostics nodeBuiltinImport:off
/**
 * End to end over a real socket: the auth routes served by a Node HTTP server
 * on 127.0.0.1, with the Tailscale CLI answered by a fake. The socket's peer is
 * genuinely loopback, which is exactly what Tailscale Serve's proxy looks like.
 */
import * as NodeHttp from "node:http";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentHttpApi } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as NetAddress from "effect/unstable/net/NetAddress";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import * as EnvironmentAuth from "../../auth/EnvironmentAuth.ts";
import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import { authHttpApiLayer, environmentAuthenticatedAuthLayer } from "../../auth/http.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import { serveProxyGate } from "./serveProxy.ts";
import * as TailnetTrust from "./TailnetTrust.ts";
import type { TailnetPeer, TailnetSelf } from "./tailnetTrustDecision.ts";
import * as TailscaleIdentity from "./tailscaleIdentity.ts";

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

class AuthTestApi extends HttpApi.make("environment").add(EnvironmentHttpApi.groups.auth) {}

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

/** Exactly what Tailscale Serve adds when it proxies the phone to 127.0.0.1. */
const serveHeaders = {
  host: "brenos-mac-mini.tail72660c.ts.net",
  "tailscale-user-login": self.loginName,
  "x-forwarded-for": PHONE_ADDRESS,
};

interface Scenario {
  readonly trustEnabled: boolean;
  readonly whois: TailnetPeer | "fail";
}

function serverLayer(scenario: Scenario) {
  const whoisCalls: Array<string> = [];
  const configLayer = Layer.effect(
    ServerConfig.ServerConfig,
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      return {
        ...config,
        mode: "desktop",
        host: "127.0.0.1",
        tailnetTrustEnabled: scenario.trustEnabled,
        tailnetTrustedNodeNames: [],
        tailscaleServeEnabled: true,
      } satisfies ServerConfig.ServerConfig["Service"];
    }),
  ).pipe(
    Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "t3-tailnet-http-test-" })),
    Layer.provide(NodeServices.layer),
  );
  const cliLayer = Layer.succeed(TailscaleIdentity.TailscaleIdentityCli, {
    readSelf: Effect.succeed(self),
    whois: (address) =>
      Effect.suspend(() => {
        whoisCalls.push(address);
        return scenario.whois === "fail"
          ? Effect.fail(
              new TailscaleIdentity.TailnetCliError({ subcommand: "whois", failure: "timeout" }),
            )
          : Effect.succeed(scenario.whois);
      }),
  });
  const environmentAuthLayer = EnvironmentAuth.layer.pipe(
    Layer.provide(SqlitePersistenceMemory),
    Layer.provide(ServerSecretStore.layer),
    Layer.provide(ServerEnvironment.identityLayer),
    Layer.provide(configLayer),
    Layer.provide(NodeServices.layer),
  );
  const routesLayer = HttpApiBuilder.layer(AuthTestApi).pipe(
    Layer.provide(authHttpApiLayer),
    Layer.provide(environmentAuthenticatedAuthLayer),
    Layer.provide(TailnetTrust.layer.pipe(Layer.provide(cliLayer), Layer.provide(configLayer))),
    Layer.provideMerge(environmentAuthLayer),
    Layer.provide(configLayer),
  );
  // Request handlers read the secret store; the auth layer keeps its own copy private.
  const secretStoreLayer = ServerSecretStore.layer.pipe(
    Layer.provide(configLayer),
    Layer.provide(NodeServices.layer),
  );
  const layer = HttpRouter.serve(routesLayer, { disableListenLog: true, disableLogger: true }).pipe(
    Layer.provideMerge(secretStoreLayer),
    Layer.provideMerge(
      NodeHttpServer.layer(() => serveProxyGate.install(NodeHttp.createServer()), {
        port: 0,
        host: "127.0.0.1",
      }),
    ),
  );
  return { layer, whoisCalls };
}

interface RawResponse {
  readonly status: number;
  readonly setCookies: ReadonlyArray<string>;
  readonly body: unknown;
}

const send = (
  port: number,
  input: {
    readonly method: "GET" | "POST";
    readonly path: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
): Effect.Effect<RawResponse> =>
  Effect.callback<RawResponse>((resume) => {
    const request = NodeHttp.request(
      { host: "127.0.0.1", port, method: input.method, path: input.path, headers: input.headers },
      (response) => {
        const chunks: Array<Buffer> = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const body = Option.getOrElse(decodeJson(text), () => text);
          resume(
            Effect.succeed({
              status: response.statusCode ?? 0,
              setCookies: response.headers["set-cookie"] ?? [],
              body,
            }),
          );
        });
      },
    );
    request.on("error", (error) => resume(Effect.die(error)));
    request.end(input.body);
  });

const getSession = (port: number, headers: Readonly<Record<string, string>>) =>
  send(port, { method: "GET", path: `${serveProxyGate.backendPath}/api/auth/session`, headers });

const listenPort = Effect.gen(function* () {
  const server = yield* HttpServer.HttpServer;
  const address = server.address;
  if (NetAddress.isUnixPathAddress(address)) return yield* Effect.die("expected a TCP listener");
  return address.port;
});

const withServer = <A>(
  scenario: Scenario,
  use: (port: number, whoisCalls: ReadonlyArray<string>) => Effect.Effect<A>,
) => {
  const { layer, whoisCalls } = serverLayer(scenario);
  return Effect.gen(function* () {
    const port = yield* listenPort;
    return yield* use(port, whoisCalls);
  }).pipe(Effect.provide(layer), Effect.scoped);
};

const cookiePair = (setCookie: string) => setCookie.split(";", 1)[0] ?? "";

describe("Trust my tailnet over HTTP", () => {
  it.live("signs in the owner's phone behind Tailscale Serve, and the cookie works", () =>
    withServer({ trustEnabled: true, whois: ownPhone }, (port, whoisCalls) =>
      Effect.gen(function* () {
        const response = yield* getSession(port, serveHeaders);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          authenticated: true,
          sessionMethod: "browser-session-cookie",
          auth: { policy: "tailnet-trusted" },
        });
        expect(whoisCalls).toEqual([PHONE_ADDRESS]);
        const sessionCookie = response.setCookies.find((cookie) => cookie.startsWith("t3_session"));
        expect(sessionCookie).toContain("HttpOnly");

        // The cookie alone, from a plain loopback request, is a working session
        // with full scopes: it may mint a pairing link for another device.
        const cookieHeader = { host: "127.0.0.1", cookie: cookiePair(sessionCookie ?? "") };
        const again = yield* getSession(port, cookieHeader);
        expect(again.body).toMatchObject({ authenticated: true });
        expect(again.setCookies).toEqual([]);
        const pairing = yield* send(port, {
          method: "POST",
          path: "/api/auth/pairing-token",
          headers: { ...cookieHeader, "content-type": "application/json" },
          body: encodeJson({}),
        });
        expect(pairing.status).toBe(200);
        expect(pairing.body).toMatchObject({ credential: expect.any(String) });
      }),
    ),
  );

  it.live("denies spoofed Serve headers sent straight to loopback", () =>
    withServer({ trustEnabled: true, whois: ownPhone }, (port, whoisCalls) =>
      Effect.gen(function* () {
        const response = yield* getSession(port, { ...serveHeaders, host: "127.0.0.1:3783" });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          authenticated: false,
          auth: {
            policy: "tailnet-trusted",
            bootstrapMethods: expect.arrayContaining(["one-time-token"]),
          },
        });
        expect(response.setCookies).toEqual([]);
        expect(whoisCalls).toEqual([]);
      }),
    ),
  );

  it.live("denies when tailscale whois fails or times out", () =>
    withServer({ trustEnabled: true, whois: "fail" }, (port) =>
      Effect.gen(function* () {
        const response = yield* getSession(port, serveHeaders);
        expect(response.body).toMatchObject({ authenticated: false });
        expect(response.setCookies).toEqual([]);
      }),
    ),
  );

  it.live("denies a node from a different tailnet", () =>
    withServer(
      { trustEnabled: true, whois: { ...ownPhone, nodeName: "phone.tail00000a.ts.net" } },
      (port) =>
        Effect.gen(function* () {
          const response = yield* getSession(port, serveHeaders);
          expect(response.body).toMatchObject({ authenticated: false });
          expect(response.setCookies).toEqual([]);
        }),
    ),
  );

  it.live("rejects forged Serve headers on the ordinary loopback endpoint", () =>
    withServer({ trustEnabled: true, whois: ownPhone }, (port, calls) =>
      Effect.gen(function* () {
        const response = yield* send(port, {
          method: "GET",
          path: "/api/auth/session",
          headers: serveHeaders,
        });
        expect(response.body).toMatchObject({ authenticated: false });
        expect(response.setCookies).toEqual([]);
        expect(calls).toEqual([]);
      }),
    ),
  );

  it.live("with the setting off, the same request pairs as before", () =>
    withServer({ trustEnabled: false, whois: ownPhone }, (port, whoisCalls) =>
      Effect.gen(function* () {
        const response = yield* getSession(port, serveHeaders);
        expect(response.body).toMatchObject({ authenticated: false });
        expect(response.body).not.toMatchObject({ auth: { policy: "tailnet-trusted" } });
        expect(response.setCookies).toEqual([]);
        expect(whoisCalls).toEqual([]);
      }),
    ),
  );
});
