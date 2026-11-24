export type RelationshipDirection = "DIRECTED" | "INVERTED";

export type RelationshipType =
  | "RESOURCE"
  | "OPERATION"
  | "COLLECTION_OPERATION"
  | "INSTANCE_OPERATION"
  | "BOUND"
  | "PUT"
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LIST"
  | "IDENTIFIER"
  | "PROPERTY"
  | "MEMBER_CONTAINER"
  | "MEMBER_TARGET"
  | "INPUT"
  | "OUTPUT"
  | "ERROR"
  | "ENUM_MEMBER"
  | "INT_ENUM_MEMBER"
  | "LIST_MEMBER"
  | "SET_MEMBER"
  | "MAP_KEY"
  | "MAP_VALUE"
  | "STRUCTURE_MEMBER"
  | "UNION_MEMBER"
  | "TRAIT"
  | "MIXIN"
  | "ID_REF";

interface RelationshipTypeInfo {
  selectorLabel: string | undefined;
  direction: RelationshipDirection;
}

const INFO: Record<RelationshipType, RelationshipTypeInfo> = {
  RESOURCE: { selectorLabel: "resource", direction: "DIRECTED" },
  OPERATION: { selectorLabel: "operation", direction: "DIRECTED" },
  COLLECTION_OPERATION: { selectorLabel: "collectionOperation", direction: "DIRECTED" },
  INSTANCE_OPERATION: { selectorLabel: "instanceOperation", direction: "DIRECTED" },
  BOUND: { selectorLabel: "bound", direction: "INVERTED" },
  PUT: { selectorLabel: "put", direction: "DIRECTED" },
  CREATE: { selectorLabel: "create", direction: "DIRECTED" },
  READ: { selectorLabel: "read", direction: "DIRECTED" },
  UPDATE: { selectorLabel: "update", direction: "DIRECTED" },
  DELETE: { selectorLabel: "delete", direction: "DIRECTED" },
  LIST: { selectorLabel: "list", direction: "DIRECTED" },
  IDENTIFIER: { selectorLabel: "identifier", direction: "DIRECTED" },
  PROPERTY: { selectorLabel: "property", direction: "DIRECTED" },
  MEMBER_CONTAINER: { selectorLabel: undefined, direction: "INVERTED" },
  MEMBER_TARGET: { selectorLabel: undefined, direction: "DIRECTED" },
  INPUT: { selectorLabel: "input", direction: "DIRECTED" },
  OUTPUT: { selectorLabel: "output", direction: "DIRECTED" },
  ERROR: { selectorLabel: "error", direction: "DIRECTED" },
  ENUM_MEMBER: { selectorLabel: "member", direction: "DIRECTED" },
  INT_ENUM_MEMBER: { selectorLabel: "member", direction: "DIRECTED" },
  LIST_MEMBER: { selectorLabel: "member", direction: "DIRECTED" },
  SET_MEMBER: { selectorLabel: "member", direction: "DIRECTED" },
  MAP_KEY: { selectorLabel: "member", direction: "DIRECTED" },
  MAP_VALUE: { selectorLabel: "member", direction: "DIRECTED" },
  STRUCTURE_MEMBER: { selectorLabel: "member", direction: "DIRECTED" },
  UNION_MEMBER: { selectorLabel: "member", direction: "DIRECTED" },
  TRAIT: { selectorLabel: "trait", direction: "DIRECTED" },
  MIXIN: { selectorLabel: "mixin", direction: "DIRECTED" },
  ID_REF: { selectorLabel: undefined, direction: "DIRECTED" },
};

/**
 * Static helpers for the {@link RelationshipType} string union.
 */
export class RelationshipTypes {
  public static getDirection(type: RelationshipType): RelationshipDirection {
    return INFO[type].direction;
  }

  public static isOperationBinding(type: RelationshipType): boolean {
    return RelationshipTypes.isInstanceOperationBinding(type) || RelationshipTypes.isCollectionOperationBinding(type);
  }

  public static isInstanceOperationBinding(type: RelationshipType): boolean {
    return type === "OPERATION" || type === "READ" || type === "UPDATE" || type === "DELETE" || type === "PUT";
  }

  public static isCollectionOperationBinding(type: RelationshipType): boolean {
    return type === "COLLECTION_OPERATION" || type === "CREATE" || type === "LIST";
  }
}
