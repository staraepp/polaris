import { ProjectIconOverride } from "@t3tools/contracts";
import { Schema } from "effect";

/**
 * Chat icons (Polaris, V 4.1.0): an icon you pick for a thread, kept on this
 * device. It reuses the project icon shape (a Lucide icon or monogram in a
 * project color, or an emoji you choose yourself), so the picker is shared.
 * Keyed by `scopedThreadKey`, like the sidebar's other per-thread state.
 */
export const THREAD_ICONS_STORAGE_KEY = "polaris:thread-icons:v1";

export const StoredThreadIcons = Schema.Record(Schema.String, ProjectIconOverride);
export type StoredThreadIcons = typeof StoredThreadIcons.Type;

export function setThreadIcon(
  icons: StoredThreadIcons,
  key: string,
  icon: ProjectIconOverride | null,
): StoredThreadIcons {
  if (icon === null) {
    if (!(key in icons)) return icons;
    const { [key]: _removed, ...rest } = icons;
    return rest;
  }
  return { ...icons, [key]: icon };
}
