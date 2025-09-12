// ToDo: Change to "fs/promises" when supporting nodejs>=14
import { promises as fsPromises } from "fs";

const { readFile } = fsPromises;

export const filePromisesHash: Record<string, Promise<string>> = {};
export const fileIntercept: Record<string, Promise<string>> = {};

interface SlurpFileOptions {
  ignoreCache?: boolean;
}

export const slurpFile = (path: string, options?: SlurpFileOptions) => {
  if (fileIntercept[path] !== undefined) {
    return fileIntercept[path];
  }
  if (!filePromisesHash[path] || options?.ignoreCache) {
    filePromisesHash[path] = readFile(path, "utf8");
  }
  return filePromisesHash[path];
};
