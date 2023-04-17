import { Provider } from "@smithy-io/types";

/**
 * @internal
 */
export const fromStatic =
  <T>(staticValue: T): Provider<T> =>
  () =>
    Promise.resolve(staticValue);
