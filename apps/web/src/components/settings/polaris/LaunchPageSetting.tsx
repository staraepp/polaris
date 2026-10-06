import { LAUNCH_PAGES, type LaunchPage } from "@t3tools/contracts";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

const LAUNCH_PAGE_LABELS: Record<LaunchPage, string> = {
  dashboard: "Dashboard",
  newThread: "New thread",
};

/** Polaris: where the app opens. */
export function LaunchPageSetting() {
  const launchPage = useClientSettings((settings) => settings.launchPage);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsRow
      {...searchableSetting("launch-page")}
      description="What you see when Polaris opens: the dashboard with your threads and activity, or a fresh draft in your most recent project."
      control={
        <Select
          value={launchPage}
          onValueChange={(value) => {
            const next = LAUNCH_PAGES.find((candidate) => candidate === value);
            if (next !== undefined) void updateSettings({ launchPage: next });
          }}
        >
          <SelectTrigger size="sm" className="w-36" aria-label="Open Polaris on">
            <SelectValue>{LAUNCH_PAGE_LABELS[launchPage]}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {LAUNCH_PAGES.map((option) => (
              <SelectItem key={option} hideIndicator value={option}>
                {LAUNCH_PAGE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
