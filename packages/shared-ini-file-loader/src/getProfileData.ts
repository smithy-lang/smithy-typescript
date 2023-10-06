import { IniSectionType, ParsedIniData } from "@smithy/types";

import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";

/**
 * Returns the profile data from parsed ini data.
 * * Returns data for `default`
 * * Reads profileName after profile prefix including/excluding quotes
 */
export const getProfileData = (data: ParsedIniData): ParsedIniData =>
  Object.entries(data)
    // filter out non-profile keys
    .filter(([key]) => key.startsWith(IniSectionType.PROFILE))
    // replace profile key with profile name
    .reduce((acc, [key, value]) => ({ ...acc, [key.split(CONFIG_PREFIX_SEPARATOR)[1]]: value }), {
      // Populate default profile, if present.
      ...(data.default && { default: data.default }),
    });
