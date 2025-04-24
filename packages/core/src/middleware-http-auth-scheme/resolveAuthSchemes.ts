import { HttpAuthScheme } from "@smithy/types";

/**
 * Resolves list of auth schemes based on the supported ones, vs the preference list.
 *
 * @param candidateAuthSchemes list of supported auth schemes selected by the standard
 *   resolution process (model-based, endpoints 2.0, etc.)
 * @param authSchemePreference list of auth schemes preferred by user.
 * @returns
 */
export const resolveAuthSchemes = (candidateAuthSchemes: HttpAuthScheme[], authSchemePreference: string[]) => {
  if (!authSchemePreference || authSchemePreference.length === 0) {
    return candidateAuthSchemes;
  }

  // reprioritize candidates based on user's preference
  const preferredAuthSchemes = [];

  for (const preferredSchemeName of authSchemePreference) {
    for (const candidateAuthScheme of candidateAuthSchemes) {
      const candidateAuthSchemeName = candidateAuthScheme.schemeId.split("#")[1];
      if (candidateAuthSchemeName === preferredSchemeName) {
        preferredAuthSchemes.push(candidateAuthScheme);
      }
    }
  }

  // add any remaining candidates that weren't in the preference list
  for (const candidateAuthScheme of candidateAuthSchemes) {
    if (!preferredAuthSchemes.find(({ schemeId }) => schemeId === candidateAuthScheme.schemeId)) {
      preferredAuthSchemes.push(candidateAuthScheme);
    }
  }

  return preferredAuthSchemes;
};
