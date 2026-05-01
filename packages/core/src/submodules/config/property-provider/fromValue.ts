import type { Provider } from "@smithy/types";

/**
 * @internal
 */
export const fromValue =
  <T>(staticValue: T): Provider<T> =>
  () =>
    Promise.resolve(staticValue);
