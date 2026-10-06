import accessibleComponents from "./templates/accessible-components.md?raw";
import frontendDesignReview from "./templates/frontend-design-review.md?raw";
import motionPolish from "./templates/motion-polish.md?raw";
import uiStates from "./templates/ui-states.md?raw";

import { readSkillFrontmatter } from "./skillStudio";

export interface SkillTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly document: string;
}

const template = (title: string, document: string): SkillTemplate => {
  const { name, description } = readSkillFrontmatter(document);
  return { id: name ?? title, title, description: description ?? "", document };
};

/**
 * Frontend skills Polaris ships (v3): written for this app's taste rules
 * and offered as starting points in the skill studio. Installing one writes
 * an ordinary SKILL.md into the project; nothing runs from here.
 */
export const SKILL_TEMPLATES: readonly SkillTemplate[] = [
  template("Frontend design review", frontendDesignReview),
  template("Accessible components", accessibleComponents),
  template("Motion polish", motionPolish),
  template("UI states", uiStates),
];
