import type { ParsedIniData } from "@smithy/types";
import { IniSectionType } from "@smithy/types";

import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";

/**
 * Returns the config data from parsed ini data.
 * * Returns data for `default`
 * * Returns profile name without prefix.
 * * Returns non-profiles as is.
 */
export const getConfigData = (data: ParsedIniData): ParsedIniData =>
  Object.entries(data)
    .filter(([key]) => {
      const indexOfSeparator = key.indexOf(CONFIG_PREFIX_SEPARATOR);
      if (indexOfSeparator === -1) {
        // filter out keys which do not contain CONFIG_PREFIX_SEPARATOR.
        return false;
      }
      // Check if prefix is a valid IniSectionType.
      return Object.values(IniSectionType).includes(key.substring(0, indexOfSeparator) as IniSectionType);
    })
    // remove profile prefix, if present.
    .reduce(
      (acc, [key, value]) => {
        const indexOfSeparator = key.indexOf(CONFIG_PREFIX_SEPARATOR);
        const updatedKey =
          key.substring(0, indexOfSeparator) === IniSectionType.PROFILE ? key.substring(indexOfSeparator + 1) : key;
        acc[updatedKey] = value;
        return acc;
      },
      {
        // Populate default profile, if present.
        ...(data.default && { default: data.default }),
      } as ParsedIniData
    );
