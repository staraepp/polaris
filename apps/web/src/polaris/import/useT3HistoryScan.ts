import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, PolarisT3HistoryScanResult } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useContext, useMemo } from "react";

import { formatEnvironmentQueryError } from "~/state/query";

import { t3HistoryScan } from "./t3HistoryState";

export interface T3HistoryScanState {
  readonly data: PolarisT3HistoryScanResult | null;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly refresh: () => void;
}

const IDLE: T3HistoryScanState = {
  data: null,
  error: null,
  isPending: false,
  refresh: () => {},
};

/** The T3 Code history scan for one computer, shaped like `useProjectScans`. */
export function useT3HistoryScan(environmentId: EnvironmentId | null): T3HistoryScanState {
  const registry = useContext(RegistryContext);
  const scanAtom = useMemo(
    () =>
      Atom.make((get): T3HistoryScanState => {
        if (environmentId === null) return IDLE;
        const atom = t3HistoryScan({ environmentId, input: {} });
        const result = get(atom);
        return {
          data: Option.getOrNull(AsyncResult.value(result)),
          error: result._tag === "Failure" ? formatEnvironmentQueryError(result.cause) : null,
          isPending: result.waiting || result._tag === "Initial",
          refresh: () => registry.refresh(atom),
        };
      }),
    [environmentId, registry],
  );
  return useAtomValue(scanAtom);
}
