import { lazy, Suspense, useEffect, useState } from "react";

import { useClientSettings } from "~/hooks/useSettings";

import { botLookFor } from "./botConfig";
import { botStateFor } from "./botState";

// Loaded only once the setting is on, so the canvas renderer stays out of the
// main bundle for everyone else.
const BotAvatar = lazy(() =>
  import("bot-avatars").then((module) => ({ default: module.BotAvatar })),
);

const STATE_TEXT = { working: "is working", default: "is ready", sleeping: "is resting" } as const;

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** Re-reads the clock once a minute: enough to notice a thread going stale. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, []);
  return now;
}

/**
 * The thread's bot in the header (Polaris): its shape and color come from the
 * provider, its state from the run. Pauses while the page is hidden; the
 * library itself pauses offscreen and honors reduced motion.
 */
export function ThreadBot({
  driver,
  providerLabel,
  running,
  waitingOnUser,
  lastActivityAt,
  theme,
}: {
  readonly driver: string | null;
  readonly providerLabel: string;
  readonly running: boolean;
  readonly waitingOnUser: boolean;
  readonly lastActivityAt: number | null;
  readonly theme: "light" | "dark";
}) {
  const overrides = useClientSettings((settings) => settings.botAvatarByDriver);
  const visible = usePageVisible();
  const now = useMinuteClock();
  const look = botLookFor(driver, overrides, theme);
  const state = botStateFor({ running, waitingOnUser, lastActivityAt, now });
  return (
    <span
      className="me-2 inline-flex size-7 shrink-0 items-center justify-center"
      data-bot-state={state}
    >
      <Suspense fallback={null}>
        <BotAvatar
          type={look.type}
          color={look.color}
          state={state}
          size={28}
          paused={!visible}
          aria-label={`${providerLabel} ${STATE_TEXT[state]}`}
        />
      </Suspense>
    </span>
  );
}
