// node:net's BlockList does the CIDR matching for both address families.
// @effect-diagnostics nodeBuiltinImport:off
/**
 * Polaris "Trust my tailnet": which addresses belong to Tailscale. Tailscale
 * hands out IPv4 addresses from the CGNAT range 100.64.0.0/10 and IPv6
 * addresses from fd7a:115c:a1e0::/48.
 */
import * as NodeNet from "node:net";

const tailnetRanges = new NodeNet.BlockList();
tailnetRanges.addSubnet("100.64.0.0", 10, "ipv4");
tailnetRanges.addSubnet("fd7a:115c:a1e0::", 48, "ipv6");

const loopbackRanges = new NodeNet.BlockList();
loopbackRanges.addSubnet("127.0.0.0", 8, "ipv4");
loopbackRanges.addAddress("::1", "ipv6");

/** Strips the IPv4-mapped IPv6 prefix and an IPv6 zone, so `::ffff:100.64.0.1` reads as IPv4. */
export function normalizeIpAddress(address: string): string {
  const trimmed = address.trim();
  const withoutZone = trimmed.includes("%") ? trimmed.slice(0, trimmed.indexOf("%")) : trimmed;
  const lower = withoutZone.toLowerCase();
  return lower.startsWith("::ffff:") && NodeNet.isIPv4(lower.slice("::ffff:".length))
    ? lower.slice("::ffff:".length)
    : lower;
}

function inRanges(ranges: NodeNet.BlockList, address: string): boolean {
  const normalized = normalizeIpAddress(address);
  if (NodeNet.isIPv4(normalized)) return ranges.check(normalized, "ipv4");
  if (NodeNet.isIPv6(normalized)) return ranges.check(normalized, "ipv6");
  return false;
}

/** True only for a literal IP inside Tailscale's ranges; host names never match. */
export function isTailnetAddress(address: string): boolean {
  return inRanges(tailnetRanges, address);
}

export function isLoopbackAddress(address: string): boolean {
  return inRanges(loopbackRanges, address);
}
