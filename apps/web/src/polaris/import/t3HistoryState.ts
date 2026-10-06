import { WS_METHODS } from "@t3tools/contracts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";

import { connectionAtomRuntime } from "~/connection/runtime";

/** T3 Code projects the server can copy threads from (read-only on T3 Code's side). */
export const t3HistoryScan = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:polaris:t3-history:scan",
  tag: WS_METHODS.polarisT3HistoryScan,
  staleTimeMs: 30_000,
  idleTtlMs: 5 * 60_000,
});

export const t3HistoryImport = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:polaris:t3-history:import",
  tag: WS_METHODS.polarisT3HistoryImport,
});
