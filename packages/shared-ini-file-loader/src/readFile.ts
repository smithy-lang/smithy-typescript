import { readFile as fsReadFile } from "node:fs/promises";

/**
 * Runtime file cache.
 * @internal
 */
export const filePromises: Record<string, Promise<string>> = {};

/**
 * For testing only.
 * @internal
 * @deprecated minimize use in application code.
 */
export const fileIntercept: Record<string, Promise<string>> = {};

/**
 * @internal
 */
export interface ReadFileOptions {
  ignoreCache?: boolean;
}

/**
 * @internal
 */
export const readFile = (path: string, options?: ReadFileOptions) => {
  if (fileIntercept[path] !== undefined) {
    return fileIntercept[path];
  }
  if (!filePromises[path] || options?.ignoreCache) {
    filePromises[path] = fsReadFile(path, "utf8");
  }
  return filePromises[path];
};
