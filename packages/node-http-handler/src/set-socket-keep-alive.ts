import { ClientRequest } from "http";

import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 3000;

export interface SocketKeepAliveOptions {
  keepAlive: boolean;
  keepAliveMsecs?: number;
}

export const setSocketKeepAlive = (
  request: ClientRequest,
  { keepAlive, keepAliveMsecs }: SocketKeepAliveOptions,
  deferTimeMs = DEFER_EVENT_LISTENER_TIME
): NodeJS.Timeout | number => {
  if (keepAlive !== true) {
    return -1;
  }

  const registerListener = () => {
    if (request.socket) {
      request.socket.setKeepAlive(keepAlive, keepAliveMsecs || 0);
    } else {
      request.on("socket", (socket) => {
        socket.setKeepAlive(keepAlive, keepAliveMsecs || 0);
      });
    }
  };

  if (deferTimeMs === 0) {
    registerListener();
    return 0;
  }

  return timing.setTimeout(registerListener, deferTimeMs);
};
