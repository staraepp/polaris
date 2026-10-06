import { Link } from "@tanstack/react-router";
import { Schema } from "effect";

import { Button } from "~/components/ui/button";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { usePrimaryEnvironmentId } from "~/state/environments";

import { t3NewThreadCount } from "../import/t3HistoryImport";
import { T3ImportHint } from "../import/T3ImportHint";
import { useT3HistoryScan } from "../import/useT3HistoryScan";

const T3ImportNoticeMemory = Schema.Struct({ dismissedAtCount: Schema.Number });
const T3_IMPORT_NOTICE_KEY = "polaris:t3-import-notice:v1";

/**
 * Dashboard notice (V 4.7.1) while T3 Code has threads Polaris does not have.
 * "Not now" hides it until T3 Code has more new threads than when dismissed.
 */
export function T3ImportNotice() {
  const environmentId = usePrimaryEnvironmentId();
  const scan = useT3HistoryScan(environmentId);
  const [memory, setMemory] = useLocalStorage(
    T3_IMPORT_NOTICE_KEY,
    { dismissedAtCount: 0 },
    T3ImportNoticeMemory,
  );
  const newCount = t3NewThreadCount(scan.data);
  if (newCount === 0 || newCount <= memory.dismissedAtCount) return null;
  return (
    <T3ImportHint
      newCount={newCount}
      action={
        <Button size="xs" render={<Link to="/import" search={{ source: "t3" }} />}>
          Bring them over
        </Button>
      }
      onDismiss={() => setMemory({ dismissedAtCount: newCount })}
    />
  );
}
