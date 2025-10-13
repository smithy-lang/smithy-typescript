import type { Logger } from "@smithy/types";
import type { ClientRequest } from "http";

import { timing } from "./timing";

/**
 * @internal
 */
export const setRequestTimeout = (
  req: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0,
  throwOnRequestTimeout?: boolean,
  logger?: Logger
) => {
  if (timeoutInMs) {
    return timing.setTimeout(() => {
      let msg = `@smithy/node-http-handler - [${
        throwOnRequestTimeout ? "ERROR" : "WARN"
      }] a request has exceeded the configured ${timeoutInMs} ms requestTimeout.`;
      if (throwOnRequestTimeout) {
        const error = Object.assign(new Error(msg), {
          name: "TimeoutError",
          code: "ETIMEDOUT",
        });
        req.destroy(error);
        reject(error);
      } else {
        msg += ` Init client requestHandler with throwOnRequestTimeout=true to turn this into an error.`;
        logger?.warn?.(msg);
      }
    }, timeoutInMs);
  }
  return -1;
};
