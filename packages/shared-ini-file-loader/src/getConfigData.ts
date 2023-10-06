import { IniSectionType, ParsedIniData } from "@smithy/types";

import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";

/**
 * Returns the config data from parsed ini data.
 * * Returns data for `default`
 * * Returns profile name without prefix.
 * * Returns non-profiles as is.
 */
export const getConfigData = (data: ParsedIniData): ParsedIniData =>
  Object.entries(data)
    // filter out
    .filter(([key]) => {
      const sections = key.split(CONFIG_PREFIX_SEPARATOR);
      if (sections.length === 2 && Object.values(IniSectionType).includes(sections[0] as IniSectionType)) {
        return true;
      }
      return false;
    })
    // replace profile prefix, if present.
    .reduce(
      (acc, [key, value]) => {
        const updatedKey = key.startsWith(IniSectionType.PROFILE) ? key.split(CONFIG_PREFIX_SEPARATOR)[1] : key;
        acc[updatedKey] = value;
        return acc;
      },
      {
        // Populate default profile, if present.
        ...(data.default && { default: data.default }),
      } as ParsedIniData
    );
