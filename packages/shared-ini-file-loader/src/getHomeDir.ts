import { homedir } from "os";
import { sep } from "path";

const homeDirCache: Record<string, string> = {};

const getHomeDirCacheKey = (): string => {
  // geteuid is only available on POSIX platforms (i.e. not Windows or Android).
  if (process && process.geteuid) {
    return `${process.geteuid()}`;
  }
  return "DEFAULT";
};

/**
 * Get the HOME directory for the current runtime.
 *
 * @internal
 */
export const getHomeDir = (): string => {
  const { HOME, USERPROFILE, HOMEPATH, HOMEDRIVE = `C:${sep}` } = process.env;

  if (HOME) return HOME;
  if (USERPROFILE) return USERPROFILE;
  if (HOMEPATH) return `${HOMEDRIVE}${HOMEPATH}`;

  const homeDirCacheKey = getHomeDirCacheKey();
  if (!homeDirCache[homeDirCacheKey]) homeDirCache[homeDirCacheKey] = homedir();

  return homeDirCache[homeDirCacheKey];
};
