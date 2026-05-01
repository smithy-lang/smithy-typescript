import type { Provider } from "@smithy/types";
/**
 * @internal
 */
export const invalidProvider: (message: string) => Provider<any> = (message: string) => () => Promise.reject(message);
