import {
  DEFAULT_QUOTA_LOW_THRESHOLD_PERCENT,
  QUOTA_LOW_THRESHOLD_OPTIONS,
} from "@t3tools/contracts";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { SettingResetButton, SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

const label = (percent: number): string => (percent === 0 ? "Off" : `${percent}% left`);

export function QuotaLowThresholdSetting() {
  const threshold = useClientSettings((settings) => settings.quotaLowThresholdPercent);
  const updateSettings = useUpdateClientSettings();
  const options: readonly number[] = QUOTA_LOW_THRESHOLD_OPTIONS.includes(
    threshold as (typeof QUOTA_LOW_THRESHOLD_OPTIONS)[number],
  )
    ? QUOTA_LOW_THRESHOLD_OPTIONS
    : [...QUOTA_LOW_THRESHOLD_OPTIONS, threshold].toSorted((a, b) => a - b);

  return (
    <SettingsRow
      {...searchableSetting("quota-low-threshold")}
      description="Flash the composer outline once, then keep a quiet amber edge, when the selected provider's 5-hour or weekly limit drops this low."
      resetAction={
        threshold !== DEFAULT_QUOTA_LOW_THRESHOLD_PERCENT ? (
          <SettingResetButton
            label="low quota warning"
            onClick={() =>
              void updateSettings({ quotaLowThresholdPercent: DEFAULT_QUOTA_LOW_THRESHOLD_PERCENT })
            }
          />
        ) : null
      }
      control={
        <Select
          value={String(threshold)}
          onValueChange={(value) =>
            void updateSettings({ quotaLowThresholdPercent: Number(value) })
          }
        >
          <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Low quota warning">
            <SelectValue>{label(threshold)}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {options.map((percent) => (
              <SelectItem key={percent} hideIndicator value={String(percent)}>
                {label(percent)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
