import { IniSectionType, ParsedIniData } from "@smithy/types";

import { CONFIG_PREFIX_SEPARATOR } from "./loadSharedConfigFiles";

/**
 * Returns the sso-session data from parsed ini data by reading
 * ssoSessionName after sso-session prefix including/excluding quotes
 */
export const getSsoSessionData = (data: ParsedIniData): ParsedIniData =>
  Object.entries(data)
    // filter out non sso-session keys
    .filter(([key]) => key.startsWith(IniSectionType.SSO_SESSION + CONFIG_PREFIX_SEPARATOR))
    // replace sso-session key with sso-session name
    .reduce((acc, [key, value]) => ({ ...acc, [key.substring(key.indexOf(CONFIG_PREFIX_SEPARATOR) + 1)]: value }), {});
