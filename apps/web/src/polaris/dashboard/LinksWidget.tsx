import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { dashboardLinkHint, type DashboardLink, resolveDashboardLink } from "./dashboardLayout";

function ArrowGlyph({ external }: { readonly external: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground">
      {external ? (
        <path
          d="M6 4h6v6M12 4l-7.5 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const rowClassName =
  "group/link flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Your own shortcuts on the dashboard (Polaris): in-app paths (`/usage`) open
 * inside Polaris, web addresses in your browser. Nothing is fetched for them
 * (no favicons), so the list makes no network calls of its own.
 */
export function LinksWidgetBody({
  title,
  links,
  onChange,
}: {
  readonly title: string;
  readonly links: readonly DashboardLink[];
  readonly onChange: (links: readonly DashboardLink[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const reset = () => {
    setAdding(false);
    setLabel("");
    setUrl("");
    setError(null);
  };

  const submit = () => {
    const target = resolveDashboardLink(url);
    if (target === null) {
      setError("Use a web address (example.com) or an in-app path (/usage).");
      return;
    }
    if (links.some((link) => resolveDashboardLink(link.url)?.href === target.href)) {
      setError("That address is already in this list.");
      return;
    }
    const name = label.trim() === "" ? url.trim() : label.trim();
    onChange([...links, { label: name, url: url.trim() }]);
    reset();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {links.length === 0 && !adding ? (
        <p className="px-2 py-1 text-sm text-muted-foreground">
          Pin the pages and sites you open every day.
        </p>
      ) : null}
      <ul className="flex flex-col">
        {links.map((link, index) => {
          const target = resolveDashboardLink(link.url);
          const hint = dashboardLinkHint(link);
          // The label keeps its width; the destination gives way first.
          const content = (
            <>
              <ArrowGlyph external={target?.kind === "external"} />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="max-w-full shrink-0 truncate">{link.label}</span>
                {hint ? (
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{hint}</span>
                ) : null}
              </span>
            </>
          );
          return (
            <li key={link.url} className="flex items-center">
              {target === null ? (
                <span className={`${rowClassName} flex-1 text-muted-foreground`}>{content}</span>
              ) : target.kind === "internal" ? (
                <Link to={target.href} className={`${rowClassName} flex-1`}>
                  {content}
                </Link>
              ) : (
                <a
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${rowClassName} flex-1`}
                >
                  {content}
                </a>
              )}
              <button
                type="button"
                aria-label={`Remove ${link.label} from ${title}`}
                onClick={() => onChange(links.filter((_, at) => at !== index))}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-hover/link:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-100 [li:hover_&]:opacity-100"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
                  <path
                    d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          className="mt-1 flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            reset();
          }}
        >
          <Input
            size="sm"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (optional)"
            aria-label="Link label"
            maxLength={60}
          />
          <Input
            size="sm"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            placeholder="example.com or /usage"
            aria-label="Link address"
            aria-invalid={error !== null || undefined}
            aria-describedby={error === null ? undefined : errorId}
            autoFocus
          />
          {error === null ? null : (
            <p id={errorId} className="text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="xs" variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" size="xs">
              Add
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="mt-auto self-start"
          onClick={() => setAdding(true)}
        >
          Add link
        </Button>
      )}
    </div>
  );
}
