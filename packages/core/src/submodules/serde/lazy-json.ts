/* eslint-disable @typescript-eslint/no-wrapper-object-types */
/**
 * @public
 *
 * A model field with this type means that you may provide a JavaScript
 * object in lieu of a JSON string, and it will be serialized to JSON
 * automatically before being sent in a request.
 *
 * For responses, you will receive a "LazyJsonString", which is a boxed String object
 * with additional mixin methods.
 * To get the string value, call `.toString()`, or to get the JSON object value,
 * call `.deserializeJSON()` or parse it yourself.
 */
export type AutomaticJsonStringConversion = Parameters<typeof JSON.stringify>[0] | LazyJsonString;

/**
 * @internal
 */
export interface LazyJsonString extends String {
  /**
   * @returns the JSON parsing of the string value.
   */
  deserializeJSON(): any;

  /**
   * @returns the original string value rather than a JSON.stringified value.
   */
  toJSON(): string;
}

/**
 * @internal
 *
 * Extension of the native String class in the previous implementation
 * has negative global performance impact on method dispatch for strings,
 * and is generally discouraged.
 *
 * This current implementation may look strange, but is necessary to preserve the interface and
 * behavior of extending the String class.
 */
export const LazyJsonString = function LazyJsonString(val: string): void {
  const str = Object.assign(new String(val), {
    deserializeJSON() {
      return JSON.parse(String(val));
    },

    toString() {
      return String(val);
    },

    toJSON() {
      return String(val);
    },
  });

  return str as never;
} as any as {
  new (s: string): LazyJsonString;
  (s: string): LazyJsonString;
  from(s: any): LazyJsonString;
  /**
   * @deprecated use #from.
   */
  fromObject(s: any): LazyJsonString;
};

LazyJsonString.from = (object: any): LazyJsonString => {
  if (object && typeof object === "object" && (object instanceof LazyJsonString || "deserializeJSON" in object)) {
    return object as any;
  } else if (typeof object === "string" || Object.getPrototypeOf(object) === String.prototype) {
    return LazyJsonString(String(object) as string) as any;
  }
  return LazyJsonString(JSON.stringify(object)) as any;
};

/**
 * @deprecated use #from.
 */
LazyJsonString.fromObject = LazyJsonString.from;
