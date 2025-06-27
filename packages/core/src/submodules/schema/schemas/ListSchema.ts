import type { ListSchema as IListSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * A schema with a single member schema.
 * The deprecated Set type may be represented as a list.
 *
 * @alpha
 */
export class ListSchema extends Schema implements IListSchema {
  public static symbol = Symbol.for("@smithy/core/schema::ListSchema");
  protected symbol = ListSchema.symbol;

  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public valueSchema: SchemaRef
  ) {
    super(name, traits);
  }

  public static [Symbol.hasInstance](lhs: unknown): lhs is ListSchema {
    const isPrototype = ListSchema.prototype.isPrototypeOf(lhs as any);
    if (!isPrototype && typeof lhs === "object" && lhs !== null) {
      const list = lhs as ListSchema;
      return list.symbol === ListSchema.symbol;
    }
    return isPrototype;
  }
}

/**
 * Factory for ListSchema.
 *
 * @internal
 */
export function list(namespace: string, name: string, traits: SchemaTraits = {}, valueSchema: SchemaRef): ListSchema {
  const schema = new ListSchema(
    namespace + "#" + name,
    traits,
    typeof valueSchema === "function" ? valueSchema() : valueSchema
  );
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
