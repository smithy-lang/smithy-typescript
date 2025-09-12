import { tokenIntercept } from "./getSSOTokenFromFile";
import { fileIntercept } from "./slurpFile";

/**
 * @internal
 */
export const externalDataInterceptor = {
  getFileRecord() {
    return fileIntercept;
  },
  interceptFile(path: string, contents: string) {
    fileIntercept[path] = Promise.resolve(contents);
  },
  getTokenRecord() {
    return tokenIntercept;
  },
  interceptToken(id: string, contents: any) {
    tokenIntercept[id] = contents;
  },
};
