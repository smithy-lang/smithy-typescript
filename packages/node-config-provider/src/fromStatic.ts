import { fromStatic as convertToProvider } from "@smithy/property-provider";
import { Provider } from "@smithy/types";

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
  isFunction(defaultValue) ? async () => await defaultValue() : convertToProvider(defaultValue);
