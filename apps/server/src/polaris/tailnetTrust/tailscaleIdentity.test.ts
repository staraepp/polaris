import { describe, expect, it } from "@effect/vitest";

import { parseTailnetPeer, parseTailnetSelf } from "./tailscaleIdentity.ts";

const statusJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    BackendState: "Running",
    Self: {
      UserID: 1930363337304003,
      DNSName: "brenos-mac-mini.tail72660c.ts.net.",
      TailscaleIPs: ["100.70.162.80", "fd7a:115c:a1e0::e92b:a251"],
    },
    User: { "1930363337304003": { ID: 1930363337304003, LoginName: "owner@example.com" } },
    CurrentTailnet: { Name: "owner@example.com", MagicDNSSuffix: "tail72660c.ts.net" },
    ...overrides,
  });

const whoisJson = (
  overrides: { node?: Record<string, unknown>; profile?: Record<string, unknown> } = {},
) =>
  JSON.stringify({
    Node: {
      Name: "iphone174.tail72660c.ts.net.",
      ComputedName: "iphone174",
      User: 1930363337304003,
      ...overrides.node,
    },
    UserProfile: { ID: 1930363337304003, LoginName: "owner@example.com", ...overrides.profile },
  });

describe("parseTailnetSelf", () => {
  it("reads this machine's identity, names without the trailing dot", () => {
    expect(parseTailnetSelf(statusJson())).toEqual({
      userId: "1930363337304003",
      loginName: "owner@example.com",
      magicDnsSuffix: "tail72660c.ts.net",
      magicDnsName: "brenos-mac-mini.tail72660c.ts.net",
      addresses: ["100.70.162.80", "fd7a:115c:a1e0::e92b:a251"],
    });
  });

  it("returns nothing unless Tailscale is running and logged in", () => {
    expect(parseTailnetSelf(statusJson({ BackendState: "NeedsLogin" }))).toBeNull();
    expect(parseTailnetSelf(statusJson({ BackendState: "Stopped" }))).toBeNull();
    expect(parseTailnetSelf(statusJson({ User: {} }))).toBeNull();
    expect(parseTailnetSelf(statusJson({ CurrentTailnet: null }))).toBeNull();
    expect(parseTailnetSelf("not json")).toBeNull();
    expect(parseTailnetSelf("[]")).toBeNull();
  });
});

describe("parseTailnetPeer", () => {
  it("reads the node and its owner", () => {
    expect(parseTailnetPeer(whoisJson())).toEqual({
      nodeName: "iphone174.tail72660c.ts.net",
      computedName: "iphone174",
      userId: "1930363337304003",
      loginName: "owner@example.com",
    });
  });

  it("returns nothing when any identity field is missing", () => {
    expect(parseTailnetPeer(whoisJson({ node: { Name: "" } }))).toBeNull();
    expect(parseTailnetPeer(whoisJson({ node: { ComputedName: null } }))).toBeNull();
    expect(parseTailnetPeer(whoisJson({ profile: { LoginName: undefined } }))).toBeNull();
    expect(parseTailnetPeer("{}")).toBeNull();
    expect(parseTailnetPeer("")).toBeNull();
  });
});
