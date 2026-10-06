import type { ProjectIconOverride } from "@t3tools/contracts";
import type { IconName } from "lucide-react/dynamic";
import { lazy, Suspense } from "react";

import { ProjectMonogram } from "~/components/ProjectMonogram";
import { cn } from "~/lib/utils";
import { projectIconColorClassName } from "~/projectIconColors";

const DynamicIcon = lazy(() =>
  import("lucide-react/dynamic").then((module) => ({ default: module.DynamicIcon })),
);

function Placeholder() {
  return <span className="size-full rounded-sm bg-current opacity-15" />;
}

/** A thread's own icon (Polaris), drawn like a project icon. */
export function ThreadIcon({
  icon,
  className,
}: {
  readonly icon: ProjectIconOverride;
  readonly className?: string | undefined;
}) {
  const box = cn("inline-flex size-3.5 shrink-0 items-center justify-center", className);
  if (icon.kind === "monogram") {
    return <ProjectMonogram text={icon.text} color={icon.color} className={box} />;
  }
  if (icon.kind === "emoji") {
    return (
      <span aria-hidden="true" className={cn(box, "[container-type:size]")}>
        <span className="text-[length:80cqh] leading-none">{icon.emoji}</span>
      </span>
    );
  }
  const color = projectIconColorClassName(icon.color);
  return (
    <span aria-hidden="true" className={cn(box, color)}>
      <Suspense fallback={<Placeholder />}>
        <DynamicIcon
          name={icon.name as IconName}
          className={cn("size-full", color)}
          fallback={Placeholder}
        />
      </Suspense>
    </span>
  );
}
