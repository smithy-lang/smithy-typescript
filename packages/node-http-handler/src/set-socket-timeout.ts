import type { ClientRequest, IncomingMessage } from "node:http";

import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 3000;

/**
 * @internal
 * @param destroyResponseBodyOnTimeout - set by the service default to retain its
 * deferred registration offset and timeout diagnostic.
 */
export const setSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0,
  destroyResponseBodyOnTimeout = false
): NodeJS.Timeout | number => {
  let response: IncomingMessage | undefined;
  request.once("response", (res) => (response = res));

  const registerTimeout = (offset: number) => {
    const timeout = timeoutInMs - offset;
    const onTimeout = () => {
      if (response?.complete) {
        if (!request.writableFinished) {
          // request.destroy() discards the completed response's unread body.
          request.socket?.destroy();
        }
        return;
      }
      const error = Object.assign(
        new Error(
          `@smithy/node-http-handler - the request socket timed out after ${timeoutInMs} ms of inactivity (${
            destroyResponseBodyOnTimeout ? "service default socket timeout" : "configured by client requestHandler"
          }).`
        ),
        { name: "TimeoutError" }
      );
      response?.destroy(error);
      request.destroy();
      reject(error);
    };

    if (request.socket?.connecting) {
      request.socket.once("connect", () => registerTimeout(offset));
    } else if (request.socket) {
      request.socket.setTimeout(timeout, onTimeout);
      request.on("close", () => request.socket?.removeListener("timeout", onTimeout));
    } else {
      // Node removes request.setTimeout() forwarding when an early response ends.
      request.once("socket", () => registerTimeout(offset));
    }
  };

  if (timeoutInMs > 0 && (!destroyResponseBodyOnTimeout || timeoutInMs < 6000)) {
    registerTimeout(0);
    return 0;
  }

  const deferralId = timing.setTimeout(
    registerTimeout.bind(null, destroyResponseBodyOnTimeout && timeoutInMs !== 0 ? DEFER_EVENT_LISTENER_TIME : 0),
    DEFER_EVENT_LISTENER_TIME
  );
  if (timeoutInMs > 0) {
    // Return 0, not deferralId, so the handler's clearTimeouts() on headers cannot cancel the
    // deferral and the timeout stays armed through the body. Cancelled on request close instead.
    request.once("close", () => timing.clearTimeout(deferralId));
    return 0;
  }
  return deferralId;
};
