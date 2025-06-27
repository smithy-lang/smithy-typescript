import type { MapSchema as IMapSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * A schema with a key schema and value schema.
 * @alpha
 */
export class MapSchema extends Schema implements IMapSchema {
  public static symbol = Symbol.for("@smithy/core/schema::MapSchema");
  protected symbol = MapSchema.symbol;

  public constructor(
    public name: string,
    public traits: SchemaTraits,
    /**
     * This is expected to be StringSchema, but may have traits.
     */
    public keySchema: SchemaRef,
    public valueSchema: SchemaRef
  ) {
    super(name, traits);
  }

  public static [Symbol.hasInstance](lhs: unknown): lhs is MapSchema {
    const isPrototype = MapSchema.prototype.isPrototypeOf(lhs as any);
    if (!isPrototype && typeof lhs === "object" && lhs !== null) {
      const map = lhs as MapSchema;
      return map.symbol === MapSchema.symbol;
    }
    return isPrototype;
  }
}

/**
 * Factory for MapSchema.
 * @internal
 */
export function map(
  namespace: string,
  name: string,
  traits: SchemaTraits = {},
  keySchema: SchemaRef,
  valueSchema: SchemaRef
): MapSchema {
  const schema = new MapSchema(
    namespace + "#" + name,
    traits,
    keySchema,
    typeof valueSchema === "function" ? valueSchema() : valueSchema
  );
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
