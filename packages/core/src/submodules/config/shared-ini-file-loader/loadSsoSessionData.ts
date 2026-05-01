import type { ParsedIniData } from "@smithy/types";

import { getConfigFilepath } from "./getConfigFilepath";
import { getSsoSessionData } from "./getSsoSessionData";
import { parseIni } from "./parseIni";
import { readFile } from "./readFile";

/**
 * Subset of {@link SharedConfigInit}.
 * @internal
 */
export interface SsoSessionInit {
  /**
   * The path at which to locate the ini config file. Defaults to the value of
   * the `AWS_CONFIG_FILE` environment variable (if defined) or
   * `~/.aws/config` otherwise.
   */
  configFilepath?: string;
}

const swallowError = () => ({});

/**
 * @internal
 */
export const loadSsoSessionData = async (init: SsoSessionInit = {}): Promise<ParsedIniData> =>
  readFile(init.configFilepath ?? getConfigFilepath())
    .then(parseIni)
    .then(getSsoSessionData)
    .catch(swallowError);
