import { Schema } from "effect";

/**
 * First steps (Polaris, V 4.1.0): onboarding that continues after the
 * welcome wizard. Every step is checked from real state, never ticked by
 * hand, so the list cannot claim something you have not done.
 */
export const FIRST_STEP_IDS = ["project", "thread", "palette", "customize", "look"] as const;
export type FirstStepId = (typeof FIRST_STEP_IDS)[number];

export const FIRST_STEP_TEXT: Record<
  FirstStepId,
  { readonly title: string; readonly hint: string }
> = {
  project: { title: "Add a project", hint: "Point Polaris at a folder you work in." },
  thread: { title: "Start a thread", hint: "Ask an agent for something small first." },
  palette: { title: "Open the command palette", hint: "Every action, one shortcut away." },
  customize: {
    title: "Make this dashboard yours",
    hint: "Customize: move, resize, or add a note.",
  },
  look: { title: "Pick a look", hint: "Orbie's accessory, a background, or theme fonts." },
};

export interface FirstStepSignals {
  readonly hasProject: boolean;
  readonly hasThread: boolean;
  readonly paletteOpened: boolean;
  readonly dashboardCustomized: boolean;
  readonly lookChanged: boolean;
}

const SIGNAL_FOR: Record<FirstStepId, keyof FirstStepSignals> = {
  project: "hasProject",
  thread: "hasThread",
  palette: "paletteOpened",
  customize: "dashboardCustomized",
  look: "lookChanged",
};

export function firstStepsProgress(signals: FirstStepSignals): {
  readonly done: ReadonlySet<FirstStepId>;
  readonly next: FirstStepId | null;
  readonly complete: boolean;
} {
  const done = new Set(FIRST_STEP_IDS.filter((id) => signals[SIGNAL_FOR[id]]));
  const next = FIRST_STEP_IDS.find((id) => !done.has(id)) ?? null;
  return { done, next, complete: next === null };
}

/** What this device remembers: hidden by the user, and the palette seen once. */
export const FirstStepsMemory = Schema.Struct({
  hidden: Schema.Boolean,
  paletteOpened: Schema.Boolean,
});
export type FirstStepsMemory = typeof FirstStepsMemory.Type;
export const FIRST_STEPS_STORAGE_KEY = "polaris:first-steps:v1";
export const FIRST_STEPS_INITIAL: FirstStepsMemory = { hidden: false, paletteOpened: false };
