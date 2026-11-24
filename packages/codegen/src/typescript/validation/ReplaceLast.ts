/** Replaces the last occurrence of a substring. */
export function replaceLast(input: string, search: string, replacement: string): string {
  const index = input.lastIndexOf(search);
  if (index < 0) {
    return input;
  }
  return input.substring(0, index) + replacement + input.substring(index + search.length);
}
