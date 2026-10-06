import {
  BOT_AVATAR_TYPES,
  type BotAvatarType,
  type BotColors,
  type BotShape,
} from "@t3tools/contracts";

import { projectIconColorClassName } from "~/projectIconColors";
import { deriveProjectIdentity } from "~/projectIdentity";

import { ORBIE_TYPE } from "./orbie";

/**
 * FNV-1a over the normalized project name. Deliberately not the project
 * color's hash, so shape and color vary independently (18 × 18 looks).
 */
function shapeHash(seed: string): number {
  const key = seed.normalize("NFKC").trim().toLocaleLowerCase("en-US") || "project";
  let hash = 0x811c9dc5;
  for (const glyph of key) {
    hash ^= glyph.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The bot's body shape. `project` is the project's name: with the mixed
 * setting every project gets its own shape, the same everywhere it shows (the
 * sidebar icon, the thread header, each answer). Orbie itself (no project)
 * stays a ball. A fixed setting gives every bot that shape.
 */
export function botTypeFor(project: string | null, shape: BotShape): BotAvatarType {
  if (shape !== "mixed") return shape;
  if (project === null) return ORBIE_TYPE;
  return BOT_AVATAR_TYPES[shapeHash(project) % BOT_AVATAR_TYPES.length] ?? ORBIE_TYPE;
}

/**
 * A text color class for the bot's body, or null for the brand color. With
 * varied colors a project's bot wears the project's generated color, the one
 * its initials badge would have had.
 */
export function botColorClassFor(project: string | null, colors: BotColors): string | null {
  if (colors !== "varied" || project === null) return null;
  return projectIconColorClassName(deriveProjectIdentity(project).color);
}
