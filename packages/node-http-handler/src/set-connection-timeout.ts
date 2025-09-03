import type { ClientRequest } from "http";

import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 1000;

export const setConnectionTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0
): NodeJS.Timeout | number => {
  if (!timeoutInMs) {
    return -1;
  }

  const registerTimeout = (offset: number) => {
    // Throw a connecting timeout error unless a connection is made within time.
    const timeoutId = timing.setTimeout(() => {
      request.destroy();
      reject(
        Object.assign(new Error(`Socket timed out without establishing a connection within ${timeoutInMs} ms`), {
          name: "TimeoutError",
        })
      );
    }, timeoutInMs - offset);

    const doWithSocket = (socket: typeof request.socket) => {
      if (socket?.connecting) {
        socket.on("connect", () => {
          timing.clearTimeout(timeoutId);
        });
      } else {
        timing.clearTimeout(timeoutId);
      }
    };

    if (request.socket) {
      doWithSocket(request.socket);
    } else {
      request.on("socket", doWithSocket);
    }
  };

  if (timeoutInMs < 2000) {
    registerTimeout(0);
    return 0;
  }

  return timing.setTimeout(registerTimeout.bind(null, DEFER_EVENT_LISTENER_TIME), DEFER_EVENT_LISTENER_TIME);
};
