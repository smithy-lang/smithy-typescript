import { Provider } from "@smithy-io/types";
/**
 * @internal
 */
export const invalidProvider: (message: string) => Provider<any> = (message: string) => () => Promise.reject(message);
