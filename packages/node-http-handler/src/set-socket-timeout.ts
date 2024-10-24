import { ClientRequest } from "http";
import { timing } from "./timing";

const DEFER_EVENT_LISTENER_TIME = 3000;

export const setSocketTimeout = (
  request: ClientRequest,
  reject: (err: Error) => void,
  timeoutInMs = 0
): NodeJS.Timeout | number => {
  const registerTimeout = (offset: number) => {
    request.setTimeout(timeoutInMs - offset, () => {
      // destroy the request
      request.destroy();
      reject(Object.assign(new Error(`Connection timed out after ${timeoutInMs} ms`), { name: "TimeoutError" }));
    });
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
