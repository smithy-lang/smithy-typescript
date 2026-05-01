import type { Provider } from "@smithy/types";

import { fromValue } from "../property-provider/fromValue";

/**
 * @internal
 */
export type FromStaticConfig<T> = T | (() => T) | Provider<T>;

/**
 * @internal
 */
type Getter<T> = (() => T) | Provider<T>;

/**
 * @internal
 */
const isFunction = <T>(func: FromStaticConfig<T>): func is Getter<T> => typeof func === "function";

/**
 * @internal
 */
export const fromStatic = <T>(defaultValue: FromStaticConfig<T>): Provider<T> =>
  isFunction(defaultValue) ? async () => await defaultValue() : fromValue(defaultValue);
