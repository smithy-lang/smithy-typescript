import { fromStatic as convertToProvider } from "@smithy-io/property-provider";
import { Provider } from "@smithy-io/types";

export type FromStaticConfig<T> = T | (() => T) | Provider<T>;
type Getter<T> = (() => T) | Provider<T>;
const isFunction = <T>(func: FromStaticConfig<T>): func is Getter<T> => typeof func === "function";

export const fromStatic = <T>(defaultValue: FromStaticConfig<T>): Provider<T> =>
  isFunction(defaultValue) ? async () => await defaultValue() : convertToProvider(defaultValue);
