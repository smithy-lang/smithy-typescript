import { SharedConfigFiles } from "@smithy/types";

import { getConfigData } from "./getConfigData";
import { getConfigFilepath } from "./getConfigFilepath";
import { getCredentialsFilepath } from "./getCredentialsFilepath";
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
}

const swallowError = () => ({});

export const CONFIG_PREFIX_SEPARATOR = ".";

export const loadSharedConfigFiles = async (init: SharedConfigInit = {}): Promise<SharedConfigFiles> => {
  const { filepath = getCredentialsFilepath(), configFilepath = getConfigFilepath() } = init;

  const parsedFiles = await Promise.all([
    slurpFile(configFilepath, {
      ignoreCache: init.ignoreCache,
    })
      .then(parseIni)
      .then(getConfigData)
      .catch(swallowError),
    slurpFile(filepath, {
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
