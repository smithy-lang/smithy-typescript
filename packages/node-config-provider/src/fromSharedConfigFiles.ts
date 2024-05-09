import { CredentialsProviderError } from "@smithy/property-provider";
import { getProfileName, loadSharedConfigFiles, SourceProfileInit } from "@smithy/shared-ini-file-loader";
import { ParsedIniData, Profile, Provider } from "@smithy/types";

export interface SharedConfigInit extends SourceProfileInit {
  /**
   * The preferred shared ini file to load the config. "config" option refers to
   * the shared config file(defaults to `~/.aws/config`). "credentials" option
   * refers to the shared credentials file(defaults to `~/.aws/credentials`)
   */
  preferredFile?: "config" | "credentials";
}

export type GetterFromConfig<T> = (profile: Profile, configFile?: ParsedIniData) => T | undefined;

/**
 * Get config value from the shared config files with inferred profile name.
 */
export const fromSharedConfigFiles =
  <T = string>(
    configSelector: GetterFromConfig<T>,
    { preferredFile = "config", ...init }: SharedConfigInit = {}
  ): Provider<T> =>
  async () => {
    const profile = getProfileName(init);
    const { configFile, credentialsFile } = await loadSharedConfigFiles(init);

    const profileFromCredentials = credentialsFile[profile] || {};
    const profileFromConfig = configFile[profile] || {};
    const mergedProfile =
      preferredFile === "config"
        ? { ...profileFromCredentials, ...profileFromConfig }
        : { ...profileFromConfig, ...profileFromCredentials };

    try {
      const cfgFile = preferredFile === "config" ? configFile : credentialsFile;
      const configValue = configSelector(mergedProfile, cfgFile);
      if (configValue === undefined) {
        throw new Error();
      }
      return configValue;
    } catch (e) {
      throw new CredentialsProviderError(
        e.message ||
          `Cannot load config for profile ${profile} in SDK configuration files with getter: ${configSelector}`
      );
    }
  };
