import type { Provider } from "@smithy/types";

/**
 * @internal
 */
export const fromStatic = <T>(staticValue: T): Provider<T> => () => Promise.resolve(staticValue);
