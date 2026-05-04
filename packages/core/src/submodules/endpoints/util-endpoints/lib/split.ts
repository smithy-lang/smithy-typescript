/**
 * The split function divides a string into an array of substrings based on a non-empty delimiter.
 * The behavior is controlled by the limit parameter:
 *
 * limit = 0: Split all occurrences (unlimited).
 * limit = 1: No split performed (returns original string as single element array).
 * limit > 1: Split into at most 'limit' parts (performs limit-1 splits).
 *
 * @internal
 */
export function split(value: string, delimiter: string, limit: number): string[] {
  if (limit === 1) {
    return [value];
  }
  if (value === "") {
    return [""];
  }
  const parts = value.split(delimiter);
  if (limit === 0) {
    return parts;
  }
  return parts.slice(0, limit - 1).concat(parts.slice(1).join(delimiter));
}
