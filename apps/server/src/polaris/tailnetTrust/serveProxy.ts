// The Node transport establishes proxy provenance before routing or logging.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeCrypto from "node:crypto";
import type * as NodeHttp from "node:http";

import { isLoopbackAddress } from "./tailnetAddress.ts";

/** Per-process capability shared only with the local Tailscale Serve config.
 * Host and identity headers alone are forgeable by an ordinary loopback client.
 * Serve prepends its configured backend path; strip it before routing/logging.
 * This protects against HTTP header spoofing, not a compromised local account
 * that can inspect this user's Tailscale configuration or session files.
 */
export function makeServeProxyGate() {
  const backendPath = `/polaris-serve-${NodeCrypto.randomBytes(32).toString("hex")}`;
  const verified = new WeakSet<object>();
  const accept = (request: NodeHttp.IncomingMessage) => {
    const url = request.url ?? "/";
    if (!isLoopbackAddress(request.socket.remoteAddress ?? "")) return;
    if (
      url !== backendPath &&
      !url.startsWith(`${backendPath}/`) &&
      !url.startsWith(`${backendPath}?`)
    )
      return;
    verified.add(request);
    const path = url.slice(backendPath.length);
    request.url = path.startsWith("/") ? path : `/${path}`;
  };
  return {
    backendPath,
    isVerified: (source: unknown) =>
      typeof source === "object" && source !== null && verified.has(source),
    install: (server: NodeHttp.Server) => {
      server.prependListener("request", accept);
      server.prependListener("upgrade", accept);
      return server;
    },
  };
}

export const serveProxyGate = makeServeProxyGate();
