import type { ClientRequest, IncomingMessage } from "node:http";

/**
 * JS-7140: applies a service default socket idle timeout, passed by generated clients
 * as the untyped `defaultSocketTimeout` option and used only when the caller has not set
 * `socketTimeout`. Unlike setSocketTimeout, the timer is attached immediately rather than
 * deferred, so it stays in force through the response body, and a timeout fails the
 * request and the body with a TimeoutError.
 *
 * @internal
 */
export const setDefaultSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs: number
): void => {
  // Keep the response so a timeout after headers fails the body with the TimeoutError;
  // destroying only the request surfaces a generic ECONNRESET "aborted" on the body.
  let response: IncomingMessage | undefined;
  request.once("response", (res) => (response = res));
  request.setTimeout(timeoutInMs, () => {
    const timeoutError = Object.assign(
      new Error(
        `@smithy/node-http-handler - the request socket timed out after ${timeoutInMs} ms of inactivity (service default socket timeout).`
      ),
      { name: "TimeoutError" }
    );
    reject(timeoutError);
    response?.destroy(timeoutError);
    request.destroy(timeoutError);
  });
};
