import { AtSignIcon, PaperclipIcon, SlashIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";

export interface GooeyPlusAction {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly onSelect: () => void;
}

// `liquid-gooey` loads only once the setting is on.
const GooeyPlusMenu = lazy(() => import("./GooeyPlusMenu"));

export function LazyGooeyPlusMenu(props: {
  readonly actions: readonly GooeyPlusAction[];
  readonly disabled?: boolean;
}) {
  return (
    <Suspense fallback={<span aria-hidden="true" className="size-8 shrink-0" />}>
      <GooeyPlusMenu {...props} />
    </Suspense>
  );
}

/** The built-in chips: attach, commands and skills, file mentions. */
export function composerPlusActions(handlers: {
  readonly onAttach: () => void;
  readonly onCommand: () => void;
  readonly onMention: () => void;
}): readonly GooeyPlusAction[] {
  return [
    { id: "attach", label: "Attach files", icon: <PaperclipIcon />, onSelect: handlers.onAttach },
    {
      id: "command",
      label: "Commands & skills",
      icon: <SlashIcon />,
      onSelect: handlers.onCommand,
    },
    { id: "mention", label: "Mention a file", icon: <AtSignIcon />, onSelect: handlers.onMention },
  ];
}
