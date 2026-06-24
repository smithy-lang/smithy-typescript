/**
 * This deliberately avoids differentiating to Buffer.concat in Node.js in favor of being isomorphic.
 * This implementation pattern is highly recognizable/optimizable by JS engines.
 * @internal
 */
export function concatBytes(arrays: Uint8Array[], length?: number): Uint8Array {
  if (length === undefined) {
    length = 0;
    for (const bytes of arrays) {
      length += bytes.byteLength;
    }
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const buf of arrays) {
    result.set(buf, offset);
    offset += buf.byteLength;
  }
  return result;
}
