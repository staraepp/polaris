import { describe, expect, it } from "@effect/vitest";

import { isLoopbackAddress, isTailnetAddress, normalizeIpAddress } from "./tailnetAddress.ts";
import {
  judgeTailnetPeer,
  selectTailnetCandidate,
  type TailnetPeer,
  type TailnetRequestFacts,
  type TailnetSelf,
} from "./tailnetTrustDecision.ts";

const self: TailnetSelf = {
  userId: "1930363337304003",
  loginName: "owner@example.com",
  magicDnsSuffix: "tail72660c.ts.net",
  magicDnsName: "brenos-mac-mini.tail72660c.ts.net",
  addresses: ["100.70.162.80", "fd7a:115c:a1e0::e92b:a251"],
};

const ownPhone: TailnetPeer = {
  nodeName: "iphone174.tail72660c.ts.net",
  computedName: "iphone174",
  userId: self.userId,
  loginName: self.loginName,
};

const facts = (overrides: Partial<TailnetRequestFacts>): TailnetRequestFacts => ({
  enabled: true,
  peerAddress: "100.88.67.96",
  serveEnabled: false,
  hostHeader: "100.70.162.80:3783",
  tailscaleUserLoginHeader: undefined,
  forwardedForHeader: undefined,
  ...overrides,
});

describe("tailnet addresses", () => {
  it("matches Tailscale's IPv4 and IPv6 ranges only", () => {
    expect(isTailnetAddress("100.64.0.1")).toBe(true);
    expect(isTailnetAddress("100.127.255.254")).toBe(true);
    expect(isTailnetAddress("100.128.0.1")).toBe(false);
    expect(isTailnetAddress("100.63.255.255")).toBe(false);
    expect(isTailnetAddress("192.168.1.20")).toBe(false);
    expect(isTailnetAddress("fd7a:115c:a1e0::e92b:a251")).toBe(true);
    expect(isTailnetAddress("fd7a:115c:a1e1::1")).toBe(false);
    expect(isTailnetAddress("::ffff:100.70.162.80")).toBe(true);
    expect(isTailnetAddress("brenos-mac-mini.tail72660c.ts.net")).toBe(false);
  });

  it("recognises loopback in both families", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.4.5.6")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("10.0.0.1")).toBe(false);
  });

  it("normalizes mapped addresses and zones", () => {
    expect(normalizeIpAddress("::FFFF:100.70.162.80")).toBe("100.70.162.80");
    expect(normalizeIpAddress("fe80::1%en0")).toBe("fe80::1");
  });
});

describe("selectTailnetCandidate", () => {
  it("does nothing while the setting is off", () => {
    expect(selectTailnetCandidate(facts({ enabled: false }), self)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("takes a tailnet peer at its socket address and ignores headers", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "::ffff:100.88.67.96",
          tailscaleUserLoginHeader: "someone@else.com",
          forwardedForHeader: "100.99.99.99",
        }),
        self,
      ),
    ).toEqual({ ok: true, candidate: { kind: "direct", peerAddress: "100.88.67.96" } });
  });

  it("denies a LAN address", () => {
    expect(selectTailnetCandidate(facts({ peerAddress: "192.168.1.44" }), self)).toEqual({
      ok: false,
      reason: "not-tailnet-address",
    });
  });

  it("denies a LAN address that claims a tailnet address in X-Forwarded-For", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "192.168.1.44",
          serveEnabled: true,
          verifiedServeProxy: true,
          hostHeader: "brenos-mac-mini.tail72660c.ts.net",
          tailscaleUserLoginHeader: self.loginName,
          forwardedForHeader: "100.88.67.96",
        }),
        self,
      ),
    ).toEqual({ ok: false, reason: "not-tailnet-address" });
  });

  it("denies a request without a socket address", () => {
    expect(selectTailnetCandidate(facts({ peerAddress: undefined }), self)).toEqual({
      ok: false,
      reason: "no-peer-address",
    });
  });

  it("denies loopback with spoofed Serve headers when Serve is off", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "127.0.0.1",
          hostHeader: "brenos-mac-mini.tail72660c.ts.net",
          tailscaleUserLoginHeader: self.loginName,
          forwardedForHeader: "100.88.67.96",
        }),
        self,
      ),
    ).toEqual({ ok: false, reason: "loopback-without-serve" });
  });

  it("denies loopback with spoofed Serve headers aimed at a local address", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "127.0.0.1",
          serveEnabled: true,
          verifiedServeProxy: true,
          hostHeader: "127.0.0.1:3783",
          tailscaleUserLoginHeader: self.loginName,
          forwardedForHeader: "100.88.67.96",
        }),
        self,
      ),
    ).toEqual({ ok: false, reason: "serve-host-mismatch" });
  });

  it("denies a DNS-rebinding page even with Serve on", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "127.0.0.1",
          serveEnabled: true,
          verifiedServeProxy: true,
          hostHeader: "attacker.example:3783",
          tailscaleUserLoginHeader: self.loginName,
          forwardedForHeader: "100.88.67.96",
        }),
        self,
      ),
    ).toEqual({ ok: false, reason: "serve-host-mismatch" });
  });

  it("denies a Serve request without the login header", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "127.0.0.1",
          serveEnabled: true,
          verifiedServeProxy: true,
          hostHeader: "brenos-mac-mini.tail72660c.ts.net",
          forwardedForHeader: "100.88.67.96",
        }),
        self,
      ),
    ).toEqual({ ok: false, reason: "serve-missing-identity" });
  });

  it("denies a Serve request whose X-Forwarded-For is a list or not a tailnet address", () => {
    const serveFacts = {
      peerAddress: "127.0.0.1",
      serveEnabled: true,
      verifiedServeProxy: true,
      hostHeader: "brenos-mac-mini.tail72660c.ts.net",
      tailscaleUserLoginHeader: self.loginName,
    };
    expect(
      selectTailnetCandidate(
        facts({ ...serveFacts, forwardedForHeader: "100.88.67.96, 10.0.0.2" }),
        self,
      ),
    ).toEqual({ ok: false, reason: "serve-forwarded-for-invalid" });
    expect(
      selectTailnetCandidate(facts({ ...serveFacts, forwardedForHeader: "203.0.113.9" }), self),
    ).toEqual({ ok: false, reason: "serve-forwarded-for-invalid" });
    expect(
      selectTailnetCandidate(facts({ ...serveFacts, forwardedForHeader: undefined }), self),
    ).toEqual({ ok: false, reason: "serve-forwarded-for-invalid" });
  });

  it("accepts a genuine Serve request and verifies the forwarded tailnet address", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "::1",
          serveEnabled: true,
          verifiedServeProxy: true,
          hostHeader: "Brenos-Mac-Mini.tail72660c.ts.net",
          tailscaleUserLoginHeader: self.loginName,
          forwardedForHeader: "100.88.67.96",
        }),
        self,
      ),
    ).toEqual({
      ok: true,
      candidate: { kind: "serve", peerAddress: "100.88.67.96", claimedLogin: self.loginName },
    });
  });

  it("denies the Serve path when this machine's Tailscale identity is unknown", () => {
    expect(
      selectTailnetCandidate(
        facts({
          peerAddress: "127.0.0.1",
          serveEnabled: true,
          verifiedServeProxy: true,
          hostHeader: "brenos-mac-mini.tail72660c.ts.net",
          tailscaleUserLoginHeader: self.loginName,
          forwardedForHeader: "100.88.67.96",
        }),
        null,
      ),
    ).toEqual({ ok: false, reason: "tailscale-unavailable" });
  });
});

describe("judgeTailnetPeer", () => {
  const direct = { kind: "direct", peerAddress: "100.88.67.96" } as const;

  it("trusts the owner's own device", () => {
    expect(
      judgeTailnetPeer({ candidate: direct, self, peer: ownPhone, allowedNodeNames: [] }),
    ).toEqual({
      trusted: true,
      via: "direct",
      nodeName: "iphone174.tail72660c.ts.net",
      computedName: "iphone174",
      loginName: self.loginName,
    });
  });

  it("denies a node shared in from a different tailnet, even with the same login", () => {
    expect(
      judgeTailnetPeer({
        candidate: direct,
        self,
        peer: { ...ownPhone, nodeName: "laptop.tail00000a.ts.net." },
        allowedNodeNames: ["laptop"],
      }),
    ).toEqual({ trusted: false, reason: "other-tailnet" });
  });

  it("denies another user's device in the same tailnet", () => {
    expect(
      judgeTailnetPeer({
        candidate: direct,
        self,
        peer: { ...ownPhone, userId: "42", loginName: "friend@example.com" },
        allowedNodeNames: [],
      }),
    ).toEqual({ trusted: false, reason: "other-user" });
  });

  it("denies a matching user id with a different login name", () => {
    expect(
      judgeTailnetPeer({
        candidate: direct,
        self,
        peer: { ...ownPhone, loginName: "impostor@example.com" },
        allowedNodeNames: [],
      }),
    ).toEqual({ trusted: false, reason: "other-user" });
  });

  it("trusts an allowlisted node of another user in the same tailnet", () => {
    const tagged = {
      ...ownPhone,
      nodeName: "kiosk.tail72660c.ts.net",
      computedName: "kiosk",
      userId: "7",
    };
    expect(
      judgeTailnetPeer({ candidate: direct, self, peer: tagged, allowedNodeNames: ["KIOSK"] }),
    ).toMatchObject({ trusted: true, computedName: "kiosk" });
    expect(
      judgeTailnetPeer({
        candidate: direct,
        self,
        peer: tagged,
        allowedNodeNames: ["kiosk.tail72660c.ts.net"],
      }),
    ).toMatchObject({ trusted: true });
  });

  it("denies a Serve request whose header login differs from whois", () => {
    expect(
      judgeTailnetPeer({
        candidate: {
          kind: "serve",
          peerAddress: "100.88.67.96",
          claimedLogin: "owner@example.com",
        },
        self,
        peer: { ...ownPhone, userId: "42", loginName: "friend@example.com" },
        allowedNodeNames: [],
      }),
    ).toEqual({ trusted: false, reason: "serve-login-mismatch" });
  });
});
