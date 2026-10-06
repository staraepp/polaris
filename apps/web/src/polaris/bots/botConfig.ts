import type { BotAvatarType } from "@t3tools/contracts";

/**
 * The built-in bot per provider driver (Polaris). Colors reuse each
 * provider's Usage color, so the bots add no palette of their own; Codex and
 * Grok are neutral and follow the theme. Unknown drivers get the clover.
 */
interface BotLook {
  readonly type: BotAvatarType;
  readonly color: { readonly light: string; readonly dark: string };
}

const NEUTRAL = { light: "#3a3a3a", dark: "#e6e6e6" } as const;
const SOFT_NEUTRAL = { light: "#6b6b6b", dark: "#bdbdbd" } as const;

const LOOK_BY_DRIVER: Readonly<Record<string, BotLook>> = {
  codex: { type: "droid", color: NEUTRAL },
  claudeAgent: { type: "star", color: { light: "#d97757", dark: "#d97757" } },
  cursor: { type: "square", color: { light: "#8b8b8b", dark: "#8b8b8b" } },
  grok: { type: "mech", color: SOFT_NEUTRAL },
  opencode: { type: "pill", color: { light: "#5b9bbd", dark: "#5b9bbd" } },
  antigravity: { type: "alien", color: { light: "#8c7bd1", dark: "#8c7bd1" } },
};

const FALLBACK_LOOK: BotLook = { type: "clover", color: SOFT_NEUTRAL };

/** Drivers listed in Settings, in this order. */
export const BOT_SETTINGS_DRIVERS = [
  { driver: "codex", label: "Codex" },
  { driver: "claudeAgent", label: "Claude Code" },
  { driver: "cursor", label: "Cursor" },
  { driver: "grok", label: "Grok Build" },
  { driver: "opencode", label: "OpenCode" },
  { driver: "antigravity", label: "Antigravity" },
] as const;

export function defaultBotType(driver: string): BotAvatarType {
  return (LOOK_BY_DRIVER[driver] ?? FALLBACK_LOOK).type;
}

export function botLookFor(
  driver: string | null,
  overrides: Readonly<Record<string, BotAvatarType>>,
  theme: "light" | "dark",
): { readonly type: BotAvatarType; readonly color: string } {
  const look = (driver === null ? undefined : LOOK_BY_DRIVER[driver]) ?? FALLBACK_LOOK;
  return {
    type: (driver === null ? undefined : overrides[driver]) ?? look.type,
    color: look.color[theme],
  };
}
