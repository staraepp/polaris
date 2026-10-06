import {
  type SidebarStageBackdropVariant,
  useSidebarStageBackdropVariant,
} from "~/components/SidebarStageBackdrop";
import { useClientSettings, useEnvironmentIdentificationMode } from "~/hooks/useSettings";

/**
 * Sidebar artwork (Polaris, V 4.7.1). Upstream draws header art only on Dev
 * and Nightly builds, to tell them apart; Polaris keeps that and shows the
 * same green blueprint on regular builds (the packaged app) while
 * `sidebarArtworkEnabled` is on. Only the sidebar uses this: the composer's
 * send button keeps upstream's rule.
 */
export function resolveSidebarArtworkVariant(
  stageVariant: SidebarStageBackdropVariant | null,
  artworkEnabled: boolean,
): SidebarStageBackdropVariant | null {
  return stageVariant ?? (artworkEnabled ? "dev" : null);
}

export function useSidebarArtworkVariant(): SidebarStageBackdropVariant | null {
  const stageVariant = useSidebarStageBackdropVariant(
    useEnvironmentIdentificationMode() === "artwork",
  );
  const artworkEnabled = useClientSettings((settings) => settings.sidebarArtworkEnabled);
  return resolveSidebarArtworkVariant(stageVariant, artworkEnabled);
}
