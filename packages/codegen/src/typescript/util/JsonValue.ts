export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function isJsonObject(value: unknown): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function printJson(value: JsonValue): string {
  return JSON.stringify(value);
}
