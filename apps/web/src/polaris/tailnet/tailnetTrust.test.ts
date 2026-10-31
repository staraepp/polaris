import type { AdvertisedEndpoint, DesktopServerExposureState } from "@t3tools/contracts";
import { createAdvertisedEndpoint } from "@t3tools/shared/advertisedEndpoint";
import { describe, expect, it } from "vite-plus/test";

import { httpsNote, isOpenToTailnet, parseNodeNamesInput, phoneAddress } from "./tailnetTrust";

const state = (
  overrides: Partial<DesktopServerExposureState> = {},
): DesktopServerExposureState => ({
  mode: "local-only",
  endpointUrl: null,
  advertisedHost: null,
  tailscaleServeEnabled: false,
  tailscaleServePort: 443,
  tailnetTrustEnabled: true,
  tailnetTrustedNodeNames: [],
  tailscaleHttpsCertificates: "disabled",
  ...overrides,
});

const endpoint = (
  id: string,
  httpBaseUrl: string,
  status: AdvertisedEndpoint["status"],
): AdvertisedEndpoint =>
  createAdvertisedEndpoint({
    id,
    label: id,
    provider: { id: "tailscale", label: "Tailscale", kind: "private-network", isAddon: true },
    source: "desktop-addon",
    httpBaseUrl,
    reachability: "private-network",
    status,
  });

const tailnetIp = endpoint(
  "tailscale-ip:http://100.70.162.80:3783",
  "http://100.70.162.80:3783",
  "available",
);
const magicDns = (status: AdvertisedEndpoint["status"]) =>
  endpoint(
    "tailscale-magicdns:https://brenos-mac-mini.tail72660c.ts.net/",
    "https://brenos-mac-mini.tail72660c.ts.net/",
    status,
  );

describe("isOpenToTailnet", () => {
  it("reads the desktop setting in the app and the auth policy in a browser", () => {
    expect(isOpenToTailnet({ desktopState: state(), authPolicy: null })).toBe(true);
    expect(
      isOpenToTailnet({ desktopState: state({ tailnetTrustEnabled: false }), authPolicy: null }),
    ).toBe(false);
    expect(isOpenToTailnet({ desktopState: null, authPolicy: "tailnet-trusted" })).toBe(true);
    expect(isOpenToTailnet({ desktopState: null, authPolicy: "remote-reachable" })).toBe(false);
  });
});

describe("phoneAddress", () => {
  it("prefers working Tailscale HTTPS", () => {
    expect(phoneAddress([tailnetIp, magicDns("available")])).toEqual({
      url: "https://brenos-mac-mini.tail72660c.ts.net/",
      secure: true,
    });
  });

  it("falls back to plain HTTP on the Tailscale IP when HTTPS is not set up", () => {
    expect(phoneAddress([magicDns("unavailable"), tailnetIp])).toEqual({
      url: "http://100.70.162.80:3783/",
      secure: false,
    });
  });

  it("has nothing to offer without Tailscale", () => {
    expect(phoneAddress([])).toBeNull();
  });
});

describe("httpsNote", () => {
  it("explains certificates when the tailnet has none", () => {
    expect(httpsNote({ state: state(), address: phoneAddress([tailnetIp]) })).toBe(
      "enable-certificates",
    );
  });

  it("points at Tailscale HTTPS when certificates are available", () => {
    expect(
      httpsNote({
        state: state({ tailscaleHttpsCertificates: "enabled" }),
        address: phoneAddress([tailnetIp]),
      }),
    ).toBe("enable-serve");
  });

  it("says nothing once HTTPS works or the setting is off", () => {
    expect(
      httpsNote({ state: state(), address: phoneAddress([tailnetIp, magicDns("available")]) }),
    ).toBe("none");
    expect(
      httpsNote({
        state: state({ tailnetTrustEnabled: false }),
        address: phoneAddress([tailnetIp]),
      }),
    ).toBe("none");
  });
});

describe("parseNodeNamesInput", () => {
  it("splits on commas, spaces and lines and drops duplicates", () => {
    expect(parseNodeNamesInput(" Kiosk, family-ipad\nkiosk ,, ")).toEqual(["kiosk", "family-ipad"]);
    expect(parseNodeNamesInput("")).toEqual([]);
  });
});
