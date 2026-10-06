import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { useTheme } from "../../../hooks/useTheme";
import {
  activeThemeFontKey,
  DEFAULT_THEME_FONT_KEY,
  withThemeFont,
} from "../../../polaris/themeFonts/themeFonts";
import { getThemeDefinition } from "../../../themePalette";
import { SettingResetButton, SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";
import { CommitInput } from "./CommitInput";

/**
 * Polaris: families the theme on screen wears over the global fonts above.
 * Edits always target the theme painting the window right now, so switching
 * themes shows (and edits) that theme's pair.
 */
export function ThemeFontsSetting() {
  const themeFonts = useClientSettings((settings) => settings.themeFonts);
  const updateSettings = useUpdateClientSettings();
  const { theme, themeHalves, resolvedTheme } = useTheme();
  const key = activeThemeFontKey(theme, themeHalves, resolvedTheme);
  const themeLabel =
    key === DEFAULT_THEME_FONT_KEY ? "the default theme" : (getThemeDefinition(key)?.label ?? key);
  const current = themeFonts[key];
  const setFamily = (role: "sans" | "code", family: string) =>
    void updateSettings({ themeFonts: withThemeFont(themeFonts, key, role, family) });

  return (
    <SettingsRow
      {...searchableSetting("theme-fonts")}
      title={`Fonts for ${themeLabel}`}
      description="Give the current theme its own interface and monospace families. Leave a field empty to use the fonts above; switch themes to set another pair."
      resetAction={
        current ? (
          <SettingResetButton
            label={`fonts for ${themeLabel}`}
            onClick={() => {
              const { [key]: _cleared, ...rest } = themeFonts;
              void updateSettings({ themeFonts: rest });
            }}
          />
        ) : null
      }
      control={
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <CommitInput
            aria-label={`Interface font for ${themeLabel}`}
            placeholder="Interface font"
            maxLength={200}
            value={current?.sans ?? ""}
            onCommit={(family) => setFamily("sans", family)}
          />
          <CommitInput
            aria-label={`Monospace font for ${themeLabel}`}
            placeholder="Monospace font"
            className="font-mono"
            maxLength={200}
            value={current?.code ?? ""}
            onCommit={(family) => setFamily("code", family)}
          />
        </div>
      }
    />
  );
}
