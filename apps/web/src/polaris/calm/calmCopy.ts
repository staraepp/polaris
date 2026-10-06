/**
 * Polaris (V 5.2.0): the shorter, friendlier wording Calm mode uses. Calm
 * keeps the same controls and drops the explanations around them; the full
 * wording stays everywhere else.
 */
export const CALM_COPY = {
  newThreadPlaceholder: "How can I help?",
  replyPlaceholder: "Reply…",
  quietPulse: "What would you like to work on?",
  withoutProject: "or just chat",
} as const;

/** "Good afternoon, Star" when there is a name to use, the plain greeting otherwise. */
export function calmGreeting(greeting: string, name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? greeting : `${greeting}, ${trimmed}`;
}

/** The composer's empty-state prompt: a question on a new thread, "Reply…" after that. */
export function calmPlaceholder(routeKind: "server" | "draft"): string {
  return routeKind === "draft" ? CALM_COPY.newThreadPlaceholder : CALM_COPY.replyPlaceholder;
}

/** The T3 Code import notice in one line, without the explanation. */
export function calmT3ImportTitle(count: number): string {
  return `You have ${count} ${count === 1 ? "thread" : "threads"} in T3 Code`;
}
