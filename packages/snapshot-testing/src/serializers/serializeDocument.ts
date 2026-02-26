import { serializeDate } from "./serializeDate";

/**
 * @internal
 */
export async function serializeDocument(doc: any, indent = 0): Promise<string> {
  const spaces = " ".repeat(indent);
  const type = doc instanceof Date ? "Date" : doc instanceof Uint8Array ? "Uint8Array" : typeof doc;

  if (doc === null) {
    return `${spaces}(null)`;
  }
  if (doc === undefined) {
    return `${spaces}(undefined)`;
  }
  if (doc instanceof Date) {
    return `${spaces}(Date) ${serializeDate(doc)}`;
  }
  if (doc instanceof Uint8Array) {
    return `${spaces}(Uint8Array) bytes[${Array.from(doc).join(", ")}]`;
  }
  if (typeof doc !== "object") {
    if (type === "string") {
      return `${spaces}"${doc}"`;
    }
    return `${spaces}(${type}) ${doc}`;
  }

  if (doc[Symbol.asyncIterator]) {
    const values = [];
    for await (const value of doc) {
      values.push(await serializeDocument(value, indent + 2));
    }
    if (values.length === 0) {
      return `${spaces}async_it[<empty>]`;
    }
    return `${spaces}async_it[\n${values.join(",\n")}\n${spaces}]`;
  }

  if (Array.isArray(doc)) {
    if (doc.length === 0) {
      return `${spaces}[]`;
    }
    const serialized = await Promise.all(doc.map((v) => serializeDocument(v, indent + 2)));
    return `${spaces}[\n${serialized.join(",\n")}\n${spaces}]`;
  }

  const keys = Object.keys(doc);
  if (keys.length === 0) {
    return `${spaces}{}`;
  }
  const serialized = await Promise.all(
    keys.map(async (k) => `${" ".repeat(indent + 2)}${k}: ${(await serializeDocument(doc[k], indent + 2)).trim()}`)
  );
  return `${spaces}{\n${serialized.join(",\n")}\n${spaces}}`;
}
