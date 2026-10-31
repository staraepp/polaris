/**
 * Polaris "Trust my tailnet": this machine's Tailscale identity and
 * `tailscale whois` lookups. The CLI sits behind a service so tests can answer
 * for it. Output is parsed here and never logged: whois and status describe
 * other people's devices.
 */
import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import type { TailnetPeer, TailnetSelf } from "./tailnetTrustDecision.ts";

const STATUS_TIMEOUT = Duration.millis(1_500);
const WHOIS_TIMEOUT = Duration.seconds(2);

export const TailnetCliFailure = Schema.Literals(["spawn", "exit", "timeout", "unparseable"]);
export type TailnetCliFailure = typeof TailnetCliFailure.Type;

export class TailnetCliError extends Schema.TaggedError<TailnetCliError>()("TailnetCliError", {
  subcommand: Schema.Literals(["status", "whois"]),
  failure: TailnetCliFailure,
}) {
  override get message(): string {
    return `tailscale ${this.subcommand} failed (${this.failure}).`;
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function identifier(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return text(value);
}

function withoutTrailingDot(name: string): string {
  return name.replace(/\.$/u, "");
}

function parseJson(source: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(source));
  } catch {
    return null;
  }
}

/** `tailscale status --json` → this machine, or null when logged out or incomplete. */
export function parseTailnetSelf(statusJson: string): TailnetSelf | null {
  const status = parseJson(statusJson);
  if (status === null || status.BackendState !== "Running") return null;
  const self = record(status.Self);
  const userId = identifier(self.UserID);
  const users = record(status.User);
  const loginName = userId === null ? null : text(record(users[userId]).LoginName);
  const magicDnsSuffix =
    text(record(status.CurrentTailnet).MagicDNSSuffix) ?? text(status.MagicDNSSuffix);
  if (userId === null || loginName === null || magicDnsSuffix === null) return null;
  const dnsName = text(self.DNSName);
  const addresses = Array.isArray(self.TailscaleIPs)
    ? self.TailscaleIPs.filter((address): address is string => typeof address === "string")
    : [];
  return {
    userId,
    loginName,
    magicDnsSuffix: withoutTrailingDot(magicDnsSuffix),
    magicDnsName: dnsName === null ? null : withoutTrailingDot(dnsName),
    addresses,
  };
}

/** `tailscale whois --json <ip>` → the node and its owner, or null when incomplete. */
export function parseTailnetPeer(whoisJson: string): TailnetPeer | null {
  const whois = parseJson(whoisJson);
  if (whois === null) return null;
  const node = record(whois.Node);
  const profile = record(whois.UserProfile);
  const nodeName = text(node.Name);
  const computedName = text(node.ComputedName);
  const userId = identifier(profile.ID) ?? identifier(node.User);
  const loginName = text(profile.LoginName);
  if (nodeName === null || computedName === null || userId === null || loginName === null) {
    return null;
  }
  return { nodeName: withoutTrailingDot(nodeName), computedName, userId, loginName };
}

export class TailscaleIdentityCli extends Context.Service<
  TailscaleIdentityCli,
  {
    readonly readSelf: Effect.Effect<TailnetSelf, TailnetCliError>;
    readonly whois: (address: string) => Effect.Effect<TailnetPeer, TailnetCliError>;
  }
>()("t3/polaris/tailnetTrust/tailscaleIdentity/TailscaleIdentityCli") {}

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (accumulated, chunk) => accumulated + chunk,
    ),
  );

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const platform = yield* HostProcessPlatform;
  const executable = platform === "win32" ? "tailscale.exe" : "tailscale";

  const run = (
    subcommand: "status" | "whois",
    args: ReadonlyArray<string>,
    timeout: Duration.Duration,
  ): Effect.Effect<string, TailnetCliError> =>
    Effect.gen(function* () {
      const child = yield* spawner.spawn(ChildProcess.make(executable, args)).pipe(
        Effect.mapError(() => new TailnetCliError({ subcommand, failure: "spawn" })),
        Effect.catchDefect(() =>
          Effect.fail(new TailnetCliError({ subcommand, failure: "spawn" })),
        ),
      );
      const [stdout, exitCode] = yield* Effect.all(
        [
          collectText(child.stdout),
          child.exitCode.pipe(Effect.map(Number)),
          // Drained so the child never blocks on a full pipe; never logged.
          collectText(child.stderr),
        ],
        { concurrency: "unbounded" },
      ).pipe(Effect.mapError(() => new TailnetCliError({ subcommand, failure: "exit" })));
      if (exitCode !== 0) return yield* new TailnetCliError({ subcommand, failure: "exit" });
      return stdout;
    }).pipe(
      Effect.scoped,
      Effect.timeout(timeout),
      Effect.catchTag("TimeoutError", () =>
        Effect.fail(new TailnetCliError({ subcommand, failure: "timeout" })),
      ),
    );

  return TailscaleIdentityCli.of({
    readSelf: run("status", ["status", "--json"], STATUS_TIMEOUT).pipe(
      Effect.flatMap((output) => {
        const self = parseTailnetSelf(output);
        return self === null
          ? Effect.fail(new TailnetCliError({ subcommand: "status", failure: "unparseable" }))
          : Effect.succeed(self);
      }),
    ),
    whois: (address) =>
      run("whois", ["whois", "--json", address], WHOIS_TIMEOUT).pipe(
        Effect.flatMap((output) => {
          const peer = parseTailnetPeer(output);
          return peer === null
            ? Effect.fail(new TailnetCliError({ subcommand: "whois", failure: "unparseable" }))
            : Effect.succeed(peer);
        }),
      ),
  });
});

export const layer = Layer.effect(TailscaleIdentityCli, make);
