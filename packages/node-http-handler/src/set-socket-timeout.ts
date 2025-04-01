import { ClientRequest } from "http";

import { DEFAULT_REQUEST_TIMEOUT } from "./node-http-handler";
import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 3000;

export const setSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = DEFAULT_REQUEST_TIMEOUT
): NodeJS.Timeout | number => {
  const registerTimeout = (offset: number) => {
    const timeout = timeoutInMs - offset;
    const onTimeout = () => {
      request.destroy();
      reject(Object.assign(new Error(`Connection timed out after ${timeoutInMs} ms`), { name: "TimeoutError" }));
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

  return timing.setTimeout(
    registerTimeout.bind(null, timeoutInMs === 0 ? 0 : DEFER_EVENT_LISTENER_TIME),
    DEFER_EVENT_LISTENER_TIME
  );
};
