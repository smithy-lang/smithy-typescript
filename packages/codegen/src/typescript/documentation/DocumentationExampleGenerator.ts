import { isJsonObject, type JsonValue } from "../util/JsonValue";

/**
 * Writes curated example values as JavaScript object literals.
 */
export class DocumentationExampleGenerator {
  private constructor() {}

  public static inputToJavaScriptObject(node: { [key: string]: JsonValue } | null | undefined): string {
    if (node === null || node === undefined) {
      return "{ /* empty */ }";
    }
    return write(node, 0);
  }

  public static outputToJavaScriptObject(node: { [key: string]: JsonValue } | null | undefined): string {
    if (node === null || node === undefined) {
      return "{ /* metadata only */ }";
    }
    return write(node, 0);
  }
}

function write(node: JsonValue, indent: number): string {
  const indentation = " ".repeat(indent);

  if (isJsonObject(node)) {
    const keys = Object.keys(node);
    if (keys.length === 0) {
      return indentation + "{ /* empty */ }";
    }
    const membersJoined = keys
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((key) => indentation + "  " + key + ": " + write(node[key], indent + 2))
      .join(",\n");
    return "{\n" + membersJoined + "\n" + indentation + "}";
  }
  if (Array.isArray(node)) {
    if (node.length === 0) {
      return indentation + "[]";
    }
    const membersJoined = node.map((element) => indentation + "  " + write(element, indent + 2)).join(",\n");
    return "[\n" + membersJoined + "\n" + indentation + "]";
  }
  if (typeof node === "string") {
    return node.includes('"') ? "`" + node + "`" : '"' + node + '"';
  }
  return String(node);
}
