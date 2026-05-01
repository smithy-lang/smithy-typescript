/**
 * @internal
 */
export const ENV_PROFILE = "AWS_PROFILE";

/**
 * @internal
 */
export const DEFAULT_PROFILE = "default";

/**
 * Returns profile with priority order code - ENV - default.
 * @internal
 */
export const getProfileName = (init: { profile?: string }): string =>
  init.profile || process.env[ENV_PROFILE] || DEFAULT_PROFILE;
