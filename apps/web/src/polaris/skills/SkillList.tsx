import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";

import type { StudioSkill, StudioSkillGroup } from "./skillStudio";
import type { SkillTemplate } from "./skillTemplates";

export type StudioSelection =
  | { readonly type: "skill"; readonly key: string }
  | { readonly type: "template"; readonly id: string };

function Row({
  label,
  detail,
  selected,
  muted,
  onSelect,
}: {
  readonly label: string;
  readonly detail: string | undefined;
  readonly selected: boolean;
  readonly muted?: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className={cn(
          "flex w-full min-w-0 flex-col rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-accent text-accent-foreground hover:bg-accent",
        )}
      >
        <span
          className={cn("truncate text-sm", muted ? "text-muted-foreground" : "text-foreground")}
        >
          {label}
        </span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </button>
    </li>
  );
}

function GroupHeading({ children }: { readonly children: string }) {
  return (
    <h3 className="px-2.5 pb-1 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
      {children}
    </h3>
  );
}

const isSelectedSkill = (selection: StudioSelection | null, skill: StudioSkill) =>
  selection?.type === "skill" && selection.key === skill.key;

/** The studio's side panel: the provider's skills by source, then Polaris's templates. */
export function SkillList({
  groups,
  templates,
  query,
  onQueryChange,
  selection,
  onSelect,
  pending,
}: {
  readonly groups: readonly StudioSkillGroup[];
  readonly templates: readonly SkillTemplate[];
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly selection: StudioSelection | null;
  readonly onSelect: (selection: StudioSelection) => void;
  readonly pending: boolean;
}) {
  return (
    <nav aria-label="Skills" className="flex min-h-0 flex-col gap-3">
      <Input
        size="sm"
        type="search"
        aria-label="Filter skills"
        placeholder="Filter skills"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <div className="flex min-h-0 flex-col">
        {groups.length === 0 ? (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">
            {pending
              ? "Looking for skills…"
              : query
                ? "No skill matches that filter."
                : "This provider reports no skills here yet."}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.kind} aria-label={group.label} className="mt-3 first:mt-0">
              <GroupHeading>{group.label}</GroupHeading>
              <ul className="flex flex-col">
                {group.skills.map((entry) => (
                  <Row
                    key={entry.key}
                    label={entry.label}
                    detail={entry.skill.shortDescription ?? entry.skill.description}
                    muted={!entry.skill.enabled}
                    selected={isSelectedSkill(selection, entry)}
                    onSelect={() => onSelect({ type: "skill", key: entry.key })}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
        <section
          aria-label="Templates from Polaris"
          className="mt-2 border-t border-border/60 pt-3"
        >
          <GroupHeading>Templates from Polaris</GroupHeading>
          <ul className="flex flex-col">
            {templates.map((template) => (
              <Row
                key={template.id}
                label={template.title}
                detail={template.id}
                selected={selection?.type === "template" && selection.id === template.id}
                onSelect={() => onSelect({ type: "template", id: template.id })}
              />
            ))}
          </ul>
        </section>
      </div>
    </nav>
  );
}
