import type { ClientRequest, IncomingMessage } from "node:http";

import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 3000;

/**
 * @internal
 * Sets a rolling socket idle timeout that stays armed through the response body. Timeouts of
 * 6000 ms or more register after 3000 ms, so requests that finish sooner skip the socket
 * listener, and may fire up to 3000 ms late.
 *
 * @param isServiceDefault - whether timeoutInMs is the service default, which labels the error.
 * The timeout is not cancelled on headers. It is removed, or its deferral cleared, when the
 * request closes.
 */
export const setSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0,
  isServiceDefault = false
): void => {
  if (!Number.isFinite(timeoutInMs) || timeoutInMs <= 0) {
    return;
  }
  let response: IncomingMessage | undefined;
  request.once("response", (res) => (response = res));

  const onTimeout = () => {
    if (response?.complete) {
      // The body is fully buffered and stays readable. Free the socket, which may still be
      // held by an unfinished upload or an unread body.
      request.socket?.destroy();
      return;
    }
    const error = Object.assign(
      new Error(
        `@smithy/node-http-handler - the request socket timed out after ${timeoutInMs} ms of inactivity (${
          isServiceDefault ? "service default socket timeout" : "configured by client requestHandler"
        }).`
      ),
      { name: "TimeoutError" }
    );
    // After headers the request promise has resolved, so the body carries the error.
    response?.destroy(error);
    request.destroy();
    reject(error);
  };

  // Registered on the socket rather than via request.setTimeout(), whose forwarding Node
  // removes when an early response ends. Connection setup is left to connectionTimeout.
  const registerTimeout = () => {
    const { socket } = request;
    if (!socket) {
      request.once("socket", registerTimeout);
    } else if (socket.connecting) {
      socket.once("connect", registerTimeout);
    } else {
      socket.setTimeout(timeoutInMs, onTimeout);
      request.on("close", () => socket.removeListener("timeout", onTimeout));
    }
  };

  if (timeoutInMs < 6000) {
    registerTimeout();
    return;
  }
  const deferralId = timing.setTimeout(registerTimeout, DEFER_EVENT_LISTENER_TIME);
  request.once("close", () => timing.clearTimeout(deferralId));
};
