import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("~/state/pullRequests", () => ({ usePullRequestList: vi.fn() }));
vi.mock("~/state/environments", () => ({ useEnvironments: vi.fn() }));

import type { EnvironmentPullRequestEntry } from "~/components/pullRequest/pullRequestList.logic";

import { newestOpenPullRequests } from "./PullRequestsTile";

const entry = (number: number, updatedAt: string, state = "open") =>
  ({ number, updatedAt, state }) as unknown as EnvironmentPullRequestEntry;

describe("newestOpenPullRequests", () => {
  it("keeps open pull requests, newest first, up to the limit", () => {
    const rows = newestOpenPullRequests(
      [
        entry(1, "2026-10-01T00:00:00Z"),
        entry(2, "2026-10-04T00:00:00Z", "merged"),
        entry(3, "2026-10-03T00:00:00Z"),
        entry(4, "2026-10-05T00:00:00Z"),
      ],
      2,
    );
    expect(rows.map((row) => row.number)).toEqual([4, 3]);
  });
});
