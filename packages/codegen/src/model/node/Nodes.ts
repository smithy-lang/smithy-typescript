import { ExpectationNotMetException } from "../exceptions/exceptions";
import { ShapeId } from "../shapes/ShapeId";

export type JsonObject = { [key: string]: unknown };

/**
 * Type checks and accessors for raw JSON values, mirroring the Node expect and get methods used by Smithy.
 *
 * @internal
 */
export class Nodes {
  public static isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  public static expectObject(value: unknown, message?: string): JsonObject {
    if (!Nodes.isObject(value)) {
      throw new ExpectationNotMetException(message ?? "Expected an object value, but found " + Nodes._describe(value));
    }
    return value;
  }

  public static expectArray(value: unknown, message?: string): unknown[] {
    if (!Array.isArray(value)) {
      throw new ExpectationNotMetException(message ?? "Expected an array value, but found " + Nodes._describe(value));
    }
    return value;
  }

  public static expectString(value: unknown, message?: string): string {
    if (typeof value !== "string") {
      throw new ExpectationNotMetException(message ?? "Expected a string value, but found " + Nodes._describe(value));
    }
    return value;
  }

  public static expectNumber(value: unknown, message?: string): number {
    if (typeof value !== "number") {
      throw new ExpectationNotMetException(message ?? "Expected a number value, but found " + Nodes._describe(value));
    }
    return value;
  }

  public static expectBoolean(value: unknown, message?: string): boolean {
    if (typeof value !== "boolean") {
      throw new ExpectationNotMetException(message ?? "Expected a boolean value, but found " + Nodes._describe(value));
    }
    return value;
  }

  public static expectShapeId(value: unknown): ShapeId {
    return ShapeId.from(Nodes.expectString(value));
  }

  public static expectMember(object: JsonObject, key: string): unknown {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      throw new ExpectationNotMetException(
        "Missing expected member `" + key + "` from object with keys: " + Object.keys(object).join(", ")
      );
    }
    return object[key];
  }

  public static getString(object: JsonObject, key: string): string | undefined {
    const value = object[key];
    return value === undefined || value === null ? undefined : Nodes.expectString(value);
  }

  public static getNumber(object: JsonObject, key: string): number | undefined {
    const value = object[key];
    return value === undefined || value === null ? undefined : Nodes.expectNumber(value);
  }

  public static getBoolean(object: JsonObject, key: string): boolean | undefined {
    const value = object[key];
    return value === undefined || value === null ? undefined : Nodes.expectBoolean(value);
  }

  public static getObject(object: JsonObject, key: string): JsonObject | undefined {
    const value = object[key];
    return value === undefined || value === null ? undefined : Nodes.expectObject(value);
  }

  public static getArray(object: JsonObject, key: string): unknown[] | undefined {
    const value = object[key];
    return value === undefined || value === null ? undefined : Nodes.expectArray(value);
  }

  public static getBooleanOrDefault(object: JsonObject, key: string, defaultValue = false): boolean {
    const value = Nodes.getBoolean(object, key);
    return value === undefined ? defaultValue : value;
  }

  public static getStringArray(object: JsonObject, key: string): string[] | undefined {
    const value = Nodes.getArray(object, key);
    return value === undefined ? undefined : Nodes.expectStringArray(value);
  }

  public static expectStringArray(value: unknown): string[] {
    return Nodes.expectArray(value).map((element) => Nodes.expectString(element));
  }

  public static expectStringMap(value: unknown): Map<string, string> {
    const object = Nodes.expectObject(value);
    const result = new Map<string, string>();
    for (const key of Object.keys(object)) {
      result.set(key, Nodes.expectString(object[key]));
    }
    return result;
  }

  private static _describe(value: unknown): string {
    if (value === null || value === undefined) {
      return "null";
    }
    return Array.isArray(value) ? "array" : typeof value;
  }
}
