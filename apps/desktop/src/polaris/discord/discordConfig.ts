/**
 * The Discord Application ID that presence is published under. It is not a
 * secret (Discord shows it in the developer portal), but Polaris does not have
 * one yet, so presence stays inert until the human registers an application
 * and pastes its ID here. `POLARIS_DISCORD_APPLICATION_ID` in the environment
 * overrides it for local testing.
 */
export const POLARIS_DISCORD_APPLICATION_ID = "";

export function resolveDiscordApplicationId(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const candidate = (env.POLARIS_DISCORD_APPLICATION_ID ?? POLARIS_DISCORD_APPLICATION_ID).trim();
  return /^\d{15,25}$/.test(candidate) ? candidate : null;
}
