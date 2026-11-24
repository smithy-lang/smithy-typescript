/**
 * @internal
 */
export type ShapeType =
  | "blob"
  | "boolean"
  | "string"
  | "timestamp"
  | "byte"
  | "short"
  | "integer"
  | "long"
  | "float"
  | "document"
  | "double"
  | "bigDecimal"
  | "bigInteger"
  | "enum"
  | "intEnum"
  | "list"
  | "set"
  | "map"
  | "structure"
  | "union"
  | "member"
  | "service"
  | "resource"
  | "operation";

type ShapeTypeCategory = "SIMPLE" | "AGGREGATE" | "SERVICE" | "MEMBER";

const CATEGORIES: Record<ShapeType, ShapeTypeCategory> = {
  blob: "SIMPLE",
  boolean: "SIMPLE",
  string: "SIMPLE",
  timestamp: "SIMPLE",
  byte: "SIMPLE",
  short: "SIMPLE",
  integer: "SIMPLE",
  long: "SIMPLE",
  float: "SIMPLE",
  document: "SIMPLE",
  double: "SIMPLE",
  bigDecimal: "SIMPLE",
  bigInteger: "SIMPLE",
  enum: "SIMPLE",
  intEnum: "SIMPLE",
  list: "AGGREGATE",
  set: "AGGREGATE",
  map: "AGGREGATE",
  structure: "AGGREGATE",
  union: "AGGREGATE",
  member: "MEMBER",
  service: "SERVICE",
  resource: "SERVICE",
  operation: "SERVICE",
};

/**
 * Static helpers for the {@link ShapeType} string union.
 *
 * @internal
 */
export class ShapeTypes {
  public static fromString(text: string): ShapeType | undefined {
    return Object.prototype.hasOwnProperty.call(CATEGORIES, text) ? (text as ShapeType) : undefined;
  }
}
