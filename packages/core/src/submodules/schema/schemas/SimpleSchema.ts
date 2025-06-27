import { SchemaRef, SchemaTraits, TraitsSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * Although numeric values exist for most simple schema, this class is used for cases where traits are
 * attached to those schema, since a single number cannot easily represent both a schema and its traits.
 *
 * @alpha
 */
export class SimpleSchema extends Schema implements TraitsSchema {
  public static symbol = Symbol.for("@smithy/core/schema::SimpleSchema");
  protected symbol = SimpleSchema.symbol;

  public constructor(
    public name: string,
    public schemaRef: SchemaRef,
    public traits: SchemaTraits
  ) {
    super(name, traits);
  }

  public static [Symbol.hasInstance](lhs: unknown): lhs is SimpleSchema {
    const isPrototype = SimpleSchema.prototype.isPrototypeOf(lhs as any);
    if (!isPrototype && typeof lhs === "object" && lhs !== null) {
      const sim = lhs as SimpleSchema;
      return sim.symbol === SimpleSchema.symbol;
    }
    return isPrototype;
  }
}

/**
 * Factory for simple schema class objects.
 *
 * @internal
 */
export function sim(namespace: string, name: string, schemaRef: SchemaRef, traits: SchemaTraits) {
  const schema = new SimpleSchema(namespace + "#" + name, schemaRef, traits);
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
