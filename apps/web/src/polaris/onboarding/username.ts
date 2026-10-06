import { COLLAB_USERNAME_PATTERN } from "@t3tools/contracts";

/** Why a username is not accepted yet, or null when it is fine. */
export function usernameProblem(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return "Pick a username so your friends know it's you.";
  if (value.length < 2) return "Use at least 2 characters.";
  if (value.length > 24) return "Use 24 characters or fewer.";
  if (!COLLAB_USERNAME_PATTERN.test(value)) {
    return "Use letters, numbers, dots, dashes or underscores (no spaces).";
  }
  return null;
}
