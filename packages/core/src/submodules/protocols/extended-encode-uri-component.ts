/**
 * Function that wraps encodeURIComponent to encode additional characters
 * to fully adhere to RFC 3986.
 *
 * @internal
 */
export function extendedEncodeURIComponent(str: string): string {
  if (/^[\w.~-]+$/.test(str)) {
    return str;
  }
  return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
