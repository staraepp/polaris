import type { EnvironmentId } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";

import { T3HistoryPanel } from "../import/T3HistoryPanel";

/** Optional last onboarding step (Polaris): shown only when T3 Code has threads to bring over. */
export function T3Step({
  environmentId,
  onFinish,
}: {
  readonly environmentId: EnvironmentId | null;
  readonly onFinish: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <T3HistoryPanel environmentId={environmentId} />
      <div className="flex justify-end border-t border-border/60 pt-4">
        <Button variant="outline" onClick={onFinish}>
          Finish setup
        </Button>
      </div>
    </div>
  );
}
