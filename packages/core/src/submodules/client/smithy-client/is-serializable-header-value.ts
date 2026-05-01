/**
 * @internal
 * @returns whether the header value is serializable.
 */
export const isSerializableHeaderValue = (value: any) => {
  return value != null;
};
