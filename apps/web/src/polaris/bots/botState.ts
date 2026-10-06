import type { BotAvatarState } from "bot-avatars";

/** Idle this long and the bot dozes off. */
export const BOT_STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * What the thread's bot is doing (Polaris): hopping while a run is going,
 * awake while it waits on you or was busy recently, asleep once the thread
 * has been quiet for a while.
 */
export function botStateFor(input: {
  readonly running: boolean;
  readonly waitingOnUser: boolean;
  readonly lastActivityAt: number | null;
  readonly now: number;
}): BotAvatarState {
  if (input.running) return "working";
  if (input.waitingOnUser) return "default";
  if (input.lastActivityAt !== null && input.now - input.lastActivityAt >= BOT_STALE_AFTER_MS) {
    return "sleeping";
  }
  return "default";
}
