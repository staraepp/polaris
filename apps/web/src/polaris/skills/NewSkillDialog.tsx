import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import {
  newSkillDocument,
  newSkillRelativePath,
  SKILL_LOCATIONS,
  type SkillLocationId,
  slugifySkillName,
} from "./skillStudio";
import type { SkillTemplate } from "./skillTemplates";

const BLANK = "blank";

export interface NewSkillRequest {
  readonly relativePath: string;
  readonly contents: string;
}

/** Names a new skill and writes its SKILL.md, blank or from a Polaris template. */
export function NewSkillDialog({
  open,
  onOpenChange,
  templates,
  initialTemplateId,
  defaultLocation,
  existingPaths,
  onCreate,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly templates: readonly SkillTemplate[];
  readonly initialTemplateId: string | null;
  readonly defaultLocation: SkillLocationId;
  readonly existingPaths: ReadonlySet<string>;
  readonly onCreate: (request: NewSkillRequest) => Promise<boolean>;
}) {
  const initialTemplate = templates.find((template) => template.id === initialTemplateId) ?? null;
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? BLANK);
  const [name, setName] = useState(initialTemplate?.id ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [location, setLocation] = useState<SkillLocationId>(defaultLocation);
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const template = templates.find((entry) => entry.id === templateId) ?? null;
  const slug = slugifySkillName(name);
  const relativePath = slug ? newSkillRelativePath(location, slug) : null;
  const taken = relativePath !== null && existingPaths.has(relativePath);
  const canCreate = relativePath !== null && !taken && description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New skill</DialogTitle>
          <DialogDescription>
            Writes a SKILL.md into this project. Agents pick it up the next time they scan for
            skills.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            id="polaris-new-skill"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canCreate || relativePath === null) return;
              setState("saving");
              void onCreate({
                relativePath,
                contents: newSkillDocument({
                  slug,
                  description,
                  body: template?.document ?? "",
                }),
              }).then((ok) => setState(ok ? "idle" : "failed"));
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="polaris-new-skill-template">Start from</Label>
              <Select
                value={templateId}
                onValueChange={(value) => {
                  const next = templates.find((entry) => entry.id === value) ?? null;
                  setTemplateId(String(value));
                  if (next !== null) {
                    setName(next.id);
                    setDescription(next.description);
                  }
                }}
              >
                <SelectTrigger id="polaris-new-skill-template" size="sm">
                  <SelectValue>{template?.title ?? "A blank skill"}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value={BLANK}>A blank skill</SelectItem>
                  {templates.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.title}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="polaris-new-skill-name">Name</Label>
              <Input
                id="polaris-new-skill-name"
                size="sm"
                autoComplete="off"
                spellCheck={false}
                value={name}
                aria-invalid={taken || undefined}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="font-mono text-xs text-muted-foreground">
                {relativePath ?? "Letters and numbers; spaces become hyphens."}
                {taken ? " already exists." : ""}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="polaris-new-skill-description">When to use it</Label>
              <Input
                id="polaris-new-skill-description"
                size="sm"
                autoComplete="off"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Agents read this to decide when the skill applies.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="polaris-new-skill-location">Folder</Label>
              <Select
                value={location}
                onValueChange={(value) => setLocation(value as SkillLocationId)}
              >
                <SelectTrigger id="polaris-new-skill-location" size="sm">
                  <SelectValue>
                    {SKILL_LOCATIONS.find((entry) => entry.id === location)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {SKILL_LOCATIONS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            {state === "failed" ? (
              <p role="alert" className="text-sm text-destructive">
                The skill could not be written. Check that the project folder is writable.
              </p>
            ) : null}
          </form>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="polaris-new-skill"
            disabled={!canCreate || state === "saving"}
          >
            {state === "saving" ? "Creating…" : "Create skill"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
