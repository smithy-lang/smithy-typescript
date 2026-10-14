import type { ClientRequest, IncomingMessage } from "node:http";

import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 3000;

/**
 * @internal
 * @param failResponseBody - also fail the response body with TimeoutError (service default).
 */
export const setSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0,
  failResponseBody = false
): NodeJS.Timeout | number => {
  // Captured only when failResponseBody is set, to fail the body on a post-headers stall.
  let response: IncomingMessage | undefined;
  if (failResponseBody) {
    request.once("response", (res) => (response = res));
  }

  const registerTimeout = (offset: number) => {
    const timeout = timeoutInMs - offset;
    const onTimeout = () => {
      const error = Object.assign(
        new Error(
          `@smithy/node-http-handler - the request socket timed out after ${timeoutInMs} ms of inactivity (${
            failResponseBody ? "service default socket timeout" : "configured by client requestHandler"
          }).`
        ),
        { name: "TimeoutError" }
      );
      if (failResponseBody) {
        response?.destroy(error);
      }
      request.destroy();
      reject(error);
    };

    if (request.socket) {
      request.socket.setTimeout(timeout, onTimeout);
      request.on("close", () => request.socket?.removeListener("timeout", onTimeout));
    } else {
      request.setTimeout(timeout, onTimeout);
    }
  };

  if (0 < timeoutInMs && timeoutInMs < 6000) {
    registerTimeout(0);
    return 0;
  }

  const deferralId = timing.setTimeout(
    registerTimeout.bind(null, timeoutInMs === 0 ? 0 : DEFER_EVENT_LISTENER_TIME),
    DEFER_EVENT_LISTENER_TIME
  );
  if (failResponseBody) {
    // Not returned, so the handler's clearTimeouts() on headers cannot cancel it and the
    // timeout stays in force through the body. Cancelled once the request closes instead.
    request.once("close", () => timing.clearTimeout(deferralId));
    return 0;
  }
  return deferralId;
};
