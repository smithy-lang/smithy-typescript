import type { ClientRequest, IncomingMessage } from "node:http";

/**
 * @internal
 * Sets a rolling socket idle timeout that stays armed through the response body.
 *
 * @param isServiceDefault - whether timeoutInMs is the service default, which labels the error.
 * @returns 0, so the handler's clearTimeouts() on headers cannot cancel the timeout. It is
 * removed when the request closes.
 */
export const setSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0,
  isServiceDefault = false
): number => {
  if (!(timeoutInMs > 0)) {
    return 0;
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

  registerTimeout();
  return 0;
};
