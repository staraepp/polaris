import type { ProjectIconOverride } from "@t3tools/contracts";
import { lazy, Suspense } from "react";

const ProjectIconPickerDialog = lazy(() =>
  import("~/components/settings/ProjectIconPickerDialog").then((module) => ({
    default: module.ProjectIconPickerDialog,
  })),
);

/** The project icon picker, titled for a thread (Polaris chat icons). */
export function ThreadIconPicker({
  target,
  current,
  onClose,
  onSelect,
}: {
  readonly target: { readonly key: string; readonly title: string } | null;
  readonly current: ProjectIconOverride | null;
  readonly onClose: () => void;
  readonly onSelect: (key: string, icon: ProjectIconOverride) => void;
}) {
  if (target === null) return null;
  return (
    <Suspense fallback={null}>
      <ProjectIconPickerDialog
        open
        current={current}
        projectName={target.title}
        title="Choose thread icon"
        description="Shown before the thread's title in the sidebar, on this device."
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onSelect={(icon) => onSelect(target.key, icon)}
      />
    </Suspense>
  );
}
