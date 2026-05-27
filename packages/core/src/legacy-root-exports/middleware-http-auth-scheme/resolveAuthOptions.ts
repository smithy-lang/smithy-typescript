import type { HttpAuthOption } from "@smithy/types";

/**
 * Resolves list of auth options based on the supported ones, vs the preference list.
 *
 * @param candidateAuthOptions list of supported auth options selected by the standard
 *   resolution process (model-based, endpoints 2.0, etc.)
 * @param authSchemePreference list of auth schemes preferred by user.
 * @returns
 */
export const resolveAuthOptions = (
  candidateAuthOptions: HttpAuthOption[],
  authSchemePreference: string[]
): HttpAuthOption[] => {
  if (!authSchemePreference || authSchemePreference.length === 0) {
    return candidateAuthOptions;
  }

  // reprioritize candidates based on user's preference
  const preferredAuthOptions = [];

  for (const preferredSchemeName of authSchemePreference) {
    for (const candidateAuthOption of candidateAuthOptions) {
      const candidateAuthSchemeName = candidateAuthOption.schemeId.split("#")[1];
      if (candidateAuthSchemeName === preferredSchemeName) {
        preferredAuthOptions.push(candidateAuthOption);
      }
    }
  }

  // add any remaining candidates that weren't in the preference list
  for (const candidateAuthOption of candidateAuthOptions) {
    if (!preferredAuthOptions.find(({ schemeId }) => schemeId === candidateAuthOption.schemeId)) {
      preferredAuthOptions.push(candidateAuthOption);
    }
  }

  return preferredAuthOptions;
};
