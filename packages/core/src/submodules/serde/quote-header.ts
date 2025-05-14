/**
 * @public
 * @param part - header list element
 * @returns quoted string if part contains delimiter.
 */
export function quoteHeader(part: string) {
  if (part.includes(",") || part.includes('"')) {
    part = `"${part.replace(/"/g, '\\"')}"`;
  }
  return part;
}
