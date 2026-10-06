import { useEffect } from "react";

import { useClientSettings, useClientSettingsHydrated } from "~/hooks/useSettings";

import { isCalmActive, setCalmActive } from "./calmStore";
import "./calm.css";

/**
 * Polaris (V 5.1.0): is Calm mode on? Effects ask this before they draw
 * (bots, orbs, beams, the gooey menu, sidebar art, the background). Until
 * settings load, the last known value avoids a flash of effects.
 */
export function useCalmMode(): boolean {
  const setting = useClientSettings((settings) => settings.calmMode);
  const hydrated = useClientSettingsHydrated();
  return hydrated ? setting : isCalmActive();
}

/** Mount once in the app shell: copies the setting to the theme module. */
export function CalmModeSync(): null {
  const setting = useClientSettings((settings) => settings.calmMode);
  const hydrated = useClientSettingsHydrated();
  useEffect(() => {
    if (hydrated) setCalmActive(setting);
  }, [hydrated, setting]);
  return null;
}
