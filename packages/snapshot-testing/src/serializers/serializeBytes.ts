import { cbor } from "@smithy/core/cbor";

/**
 * CBOR bytes with inline explanations.
 * @param bytes - to serialize.
 */
export function serializeBytes(bytes: Uint8Array): string {
  const objectString = debugBytes(bytes);
  const byteList = bytesToString(bytes);

  return `${objectString}\n\n[actual bytes]\n${byteList}`;
}

export function bytesToString(bytes: Uint8Array) {
  const items = Array.from(bytes).map((b) => String(b));
  const lines = [];
  for (let i = 0; i < items.length; i += 24) {
    lines.push(items.slice(i, i + 24).join(", "));
  }
  return lines.join(",\n");
}

export function debugBytes(bytes: Uint8Array): string {
  const object = cbor.deserialize(bytes);

  return JSON.stringify(object, null, 2);
}
