/**
 * Polaris "Trust my tailnet": the rules behind the Settings row, kept apart
 * from React so they are tested on their own.
 */
import type {
  AdvertisedEndpoint,
  DesktopServerExposureState,
  ServerAuthPolicy,
} from "@t3tools/contracts";

export const TAILSCALE_DNS_ADMIN_URL = "https://login.tailscale.com/admin/dns";

const TAILSCALE_IP_ENDPOINT_PREFIX = "tailscale-ip:";
const TAILSCALE_HTTPS_ENDPOINT_PREFIX = "tailscale-magicdns:";

/** True when this backend lets the owner's tailnet devices in without pairing. */
export function isOpenToTailnet(input: {
  readonly desktopState: DesktopServerExposureState | null;
  readonly authPolicy: ServerAuthPolicy | null;
}): boolean {
  return input.desktopState
    ? input.desktopState.tailnetTrustEnabled
    : input.authPolicy === "tailnet-trusted";
}

/**
 * The address to open on a phone: the Tailscale HTTPS name when Serve is
 * working, otherwise plain HTTP on the first Tailscale IP. Tailscale already
 * encrypts that connection end to end.
 */
export function phoneAddress(endpoints: ReadonlyArray<AdvertisedEndpoint>): {
  readonly url: string;
  readonly secure: boolean;
} | null {
  const https = endpoints.find(
    (endpoint) =>
      endpoint.id.startsWith(TAILSCALE_HTTPS_ENDPOINT_PREFIX) && endpoint.status === "available",
  );
  if (https) return { url: https.httpBaseUrl, secure: true };
  const ip = endpoints.find((endpoint) => endpoint.id.startsWith(TAILSCALE_IP_ENDPOINT_PREFIX));
  return ip ? { url: ip.httpBaseUrl, secure: false } : null;
}

export type TailnetHttpsNote = "none" | "enable-certificates" | "enable-serve";

/** Which HTTPS hint to show next to the plain-HTTP fallback, if any. */
export function httpsNote(input: {
  readonly state: DesktopServerExposureState;
  readonly address: ReturnType<typeof phoneAddress>;
}): TailnetHttpsNote {
  if (!input.state.tailnetTrustEnabled || input.address === null || input.address.secure) {
    return "none";
  }
  return input.state.tailscaleHttpsCertificates === "disabled"
    ? "enable-certificates"
    : "enable-serve";
}

/** Splits what the user typed into node names: commas, spaces or new lines. */
export function parseNodeNamesInput(text: string): ReadonlyArray<string> {
  const names = text
    .split(/[\s,]+/u)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  return [...new Set(names)];
}

export function formatNodeNames(names: ReadonlyArray<string>): string {
  return names.join(", ");
}
