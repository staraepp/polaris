import { createFileRoute } from "@tanstack/react-router";

import { SkillStudioPage } from "../polaris/skills/SkillStudioPage";

export const Route = createFileRoute("/skills")({
  component: SkillStudioPage,
});
