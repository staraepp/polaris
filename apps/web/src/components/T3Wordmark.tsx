import type { SVGProps } from "react";

// Placeholder Polaris mark (P with a north star in its counter). Upstream name kept so imports stay put.
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="13 7 43 52" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        d="M14 8h24c10 0 17 7.6 17 19s-7 19-17 19H24v12H14V8ZM24 18v18h14c4.4 0 7-3.6 7-9s-2.6-9-7-9H24Z"
        fill="currentColor"
      />
      <path
        d="M34.5 20Q35.48 26.02 41.5 27Q35.48 27.98 34.5 34Q33.52 27.98 27.5 27Q33.52 26.02 34.5 20Z"
        fill="currentColor"
      />
    </svg>
  );
}

// The north star alone, for places that already spell "Polaris" next to the mark.
export function PolarisStar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 0Q14.6 9.4 24 12Q14.6 14.6 12 24Q9.4 14.6 0 12Q9.4 9.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
