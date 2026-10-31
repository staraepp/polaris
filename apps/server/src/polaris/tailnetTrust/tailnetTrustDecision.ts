/**
 * Polaris "Trust my tailnet": the decision, as two pure steps so every rule is
 * unit-tested without Tailscale.
 *
 * 1. `selectTailnetCandidate` looks only at the TCP peer and, for requests
 *    that Tailscale Serve proxies to loopback, at Serve's identity headers.
 *    It picks the tailnet address that `tailscale whois` must confirm.
 * 2. `judgeTailnetPeer` compares what `tailscale whois` reported with this
 *    machine's own Tailscale identity.
 *
 * A request is trusted only when both steps say so. Everything else falls back
 * to the normal pairing flow.
 */
import { isLoopbackAddress, isTailnetAddress, normalizeIpAddress } from "./tailnetAddress.ts";

/** This machine as Tailscale sees it (`tailscale status --json`). */
export interface TailnetSelf {
  readonly userId: string;
  readonly loginName: string;
  /** For example `tail72660c.ts.net`. */
  readonly magicDnsSuffix: string;
  /** For example `brenos-mac-mini.tail72660c.ts.net`; null without MagicDNS. */
  readonly magicDnsName: string | null;
  readonly addresses: ReadonlyArray<string>;
}

/** A tailnet node as `tailscale whois --json <ip>` describes it. */
export interface TailnetPeer {
  /** Fully qualified, without the trailing dot. */
  readonly nodeName: string;
  /** The short host label, for example `iphone174`. */
  readonly computedName: string;
  readonly userId: string;
  readonly loginName: string;
}

export type TailnetTrustDenial =
  | "disabled"
  | "no-peer-address"
  | "not-tailnet-address"
  | "loopback-without-serve"
  | "unverified-serve-proxy"
  | "tailscale-unavailable"
  | "serve-host-mismatch"
  | "serve-missing-identity"
  | "serve-forwarded-for-invalid"
  | "whois-failed"
  | "other-tailnet"
  | "serve-login-mismatch"
  | "other-user";

export type TailnetCandidate =
  | { readonly kind: "direct"; readonly peerAddress: string }
  | { readonly kind: "serve"; readonly peerAddress: string; readonly claimedLogin: string };

export type TailnetCandidateResult =
  | { readonly ok: true; readonly candidate: TailnetCandidate }
  | { readonly ok: false; readonly reason: TailnetTrustDenial };

export type TailnetTrustVerdict =
  | {
      readonly trusted: true;
      readonly via: TailnetCandidate["kind"];
      readonly nodeName: string;
      readonly computedName: string;
      readonly loginName: string;
    }
  | { readonly trusted: false; readonly reason: TailnetTrustDenial };

export interface TailnetRequestFacts {
  readonly enabled: boolean;
  /** The socket's remote address, never a header. */
  readonly peerAddress: string | undefined;
  readonly serveEnabled: boolean;
  readonly verifiedServeProxy?: boolean;
  readonly hostHeader: string | undefined;
  readonly tailscaleUserLoginHeader: string | undefined;
  readonly forwardedForHeader: string | undefined;
}

function hostWithoutPort(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  const colon = trimmed.lastIndexOf(":");
  const withoutPort = colon === -1 ? trimmed : trimmed.slice(0, colon);
  return withoutPort.replace(/\.$/u, "");
}

function sameName(left: string, right: string): boolean {
  return (
    left.trim().replace(/\.$/u, "").toLowerCase() === right.trim().replace(/\.$/u, "").toLowerCase()
  );
}

export function selectTailnetCandidate(
  facts: TailnetRequestFacts,
  self: TailnetSelf | null,
): TailnetCandidateResult {
  if (!facts.enabled) return { ok: false, reason: "disabled" };

  const peerAddress = facts.peerAddress ? normalizeIpAddress(facts.peerAddress) : undefined;
  if (!peerAddress) return { ok: false, reason: "no-peer-address" };

  // A connection that really arrives from a tailnet address identifies itself;
  // headers are irrelevant and ignored.
  if (isTailnetAddress(peerAddress)) {
    return { ok: true, candidate: { kind: "direct", peerAddress } };
  }

  if (!isLoopbackAddress(peerAddress)) return { ok: false, reason: "not-tailnet-address" };

  // Loopback: only Tailscale Serve's proxy may vouch for a tailnet user, and
  // only when Serve is on for this server. Anything else on this machine pairs.
  if (!facts.serveEnabled) return { ok: false, reason: "loopback-without-serve" };
  if (!facts.verifiedServeProxy) return { ok: false, reason: "unverified-serve-proxy" };
  if (self === null || self.magicDnsName === null) {
    return { ok: false, reason: "tailscale-unavailable" };
  }

  // Serve forwards the MagicDNS name as Host. A page that DNS-rebinds its own
  // domain to 127.0.0.1 cannot send that Host, so it never reaches the headers.
  const hostMatches =
    facts.hostHeader !== undefined &&
    sameName(hostWithoutPort(facts.hostHeader), self.magicDnsName);
  if (!hostMatches) return { ok: false, reason: "serve-host-mismatch" };

  const claimedLogin = facts.tailscaleUserLoginHeader?.trim();
  if (!claimedLogin) return { ok: false, reason: "serve-missing-identity" };

  // Serve sends exactly one tailnet address. A list means another proxy added
  // to it, and anything outside Tailscale's ranges was not written by Serve.
  const forwardedFor = facts.forwardedForHeader?.trim();
  const forwardedIsSingleTailnetAddress =
    forwardedFor !== undefined && !forwardedFor.includes(",") && isTailnetAddress(forwardedFor);
  if (!forwardedIsSingleTailnetAddress) {
    return { ok: false, reason: "serve-forwarded-for-invalid" };
  }

  return {
    ok: true,
    candidate: { kind: "serve", peerAddress: normalizeIpAddress(forwardedFor), claimedLogin },
  };
}

export function judgeTailnetPeer(input: {
  readonly candidate: TailnetCandidate;
  readonly self: TailnetSelf;
  readonly peer: TailnetPeer;
  readonly allowedNodeNames: ReadonlyArray<string>;
}): TailnetTrustVerdict {
  const { candidate, self, peer } = input;

  // Nodes shared in from another tailnet keep their own tailnet's suffix.
  const suffix = `.${self.magicDnsSuffix.replace(/^\./u, "").replace(/\.$/u, "")}`.toLowerCase();
  const nodeName = peer.nodeName.trim().replace(/\.$/u, "").toLowerCase();
  if (!nodeName.endsWith(suffix)) return { trusted: false, reason: "other-tailnet" };

  if (candidate.kind === "serve" && !sameName(candidate.claimedLogin, peer.loginName)) {
    return { trusted: false, reason: "serve-login-mismatch" };
  }

  const isOwner = peer.userId === self.userId && sameName(peer.loginName, self.loginName);
  const isAllowedNode = input.allowedNodeNames.some(
    (allowed) => sameName(allowed, peer.computedName) || sameName(allowed, nodeName),
  );
  if (!isOwner && !isAllowedNode) return { trusted: false, reason: "other-user" };

  return {
    trusted: true,
    via: candidate.kind,
    nodeName,
    computedName: peer.computedName,
    loginName: peer.loginName,
  };
}
