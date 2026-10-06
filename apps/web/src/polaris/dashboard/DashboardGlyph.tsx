import type { SVGProps } from "react";

/** Four bento cells of unequal size (Polaris), drawn to sit with the lucide set. */
export function DashboardGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="10" height="8" rx="2" />
      <rect x="15" y="3" width="6" height="8" rx="2" />
      <rect x="3" y="13" width="6" height="8" rx="2" />
      <rect x="11" y="13" width="10" height="8" rx="2" />
    </svg>
  );
}
