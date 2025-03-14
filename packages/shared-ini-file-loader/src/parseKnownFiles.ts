import { ParsedIniData } from "@smithy/types";

import { loadSharedConfigFiles, SharedConfigInit } from "./loadSharedConfigFiles";
import { mergeConfigFiles } from "./mergeConfigFiles";

/**
 * @public
 */
export interface SourceProfileInit extends SharedConfigInit {
  /**
   * The configuration profile to use.
   */
  profile?: string;
}

/**
 * Load profiles from credentials and config INI files and normalize them into a
 * single profile list.
 *
 * @internal
 */
export const parseKnownFiles = async (init: SourceProfileInit): Promise<ParsedIniData> => {
  const parsedFiles = await loadSharedConfigFiles(init);
  return mergeConfigFiles(parsedFiles.configFile, parsedFiles.credentialsFile);
};
