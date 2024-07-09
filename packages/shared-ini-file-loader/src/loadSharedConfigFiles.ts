import { Logger, SharedConfigFiles } from "@smithy/types";
import { join } from "path";

import { getConfigData } from "./getConfigData";
import { getConfigFilepath } from "./getConfigFilepath";
import { getCredentialsFilepath } from "./getCredentialsFilepath";
import { getHomeDir } from "./getHomeDir";
import { parseIni } from "./parseIni";
import { slurpFile } from "./slurpFile";

export interface SharedConfigInit {
  /**
   * The path at which to locate the ini credentials file. Defaults to the
   * value of the `AWS_SHARED_CREDENTIALS_FILE` environment variable (if
   * defined) or `~/.aws/credentials` otherwise.
   */
  filepath?: string;

  /**
   * The path at which to locate the ini config file. Defaults to the value of
   * the `AWS_CONFIG_FILE` environment variable (if defined) or
   * `~/.aws/config` otherwise.
   */
  configFilepath?: string;

  /**
   * Configuration files are normally cached after the first time they are loaded. When this
   * property is set, the provider will always reload any configuration files loaded before.
   */
  ignoreCache?: boolean;

  /**
   * For credential resolution trace logging.
   */
  logger?: Logger;
}

const swallowError = () => ({});

export const CONFIG_PREFIX_SEPARATOR = ".";

export const loadSharedConfigFiles = async (init: SharedConfigInit = {}): Promise<SharedConfigFiles> => {
  const { filepath = getCredentialsFilepath(), configFilepath = getConfigFilepath() } = init;
  const homeDir = getHomeDir();
  const relativeHomeDirPrefix = "~/";

  let resolvedFilepath = filepath;
  if (filepath.startsWith(relativeHomeDirPrefix)) {
    resolvedFilepath = join(homeDir, filepath.slice(2));
  }

  let resolvedConfigFilepath = configFilepath;
  if (configFilepath.startsWith(relativeHomeDirPrefix)) {
    resolvedConfigFilepath = join(homeDir, configFilepath.slice(2));
  }

  const parsedFiles = await Promise.all([
    slurpFile(resolvedConfigFilepath, {
      ignoreCache: init.ignoreCache,
    })
      .then(parseIni)
      .then(getConfigData)
      .catch(swallowError),
    slurpFile(resolvedFilepath, {
      ignoreCache: init.ignoreCache,
    })
      .then(parseIni)
      .catch(swallowError),
  ]);

  return {
    configFile: parsedFiles[0],
    credentialsFile: parsedFiles[1],
  };
};
