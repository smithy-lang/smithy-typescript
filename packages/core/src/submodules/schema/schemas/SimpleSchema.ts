import type { SchemaRef, SchemaTraits, TraitsSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * Although numeric values exist for most simple schema, this class is used for cases where traits are
 * attached to those schema, since a single number cannot easily represent both a schema and its traits.
 *
 * @alpha
 */
export class SimpleSchema extends Schema implements TraitsSchema {
  public static readonly symbol = Symbol.for("@smithy/sim");
  public name!: string;
  public schemaRef!: SchemaRef;
  public traits!: SchemaTraits;
  protected readonly symbol = SimpleSchema.symbol;
}

/**
 * Factory for simple schema class objects.
 *
 * @internal
 */
export const sim = (namespace: string, name: string, schemaRef: SchemaRef, traits: SchemaTraits) =>
  Schema.assign(new SimpleSchema(), {
    name,
    namespace,
    traits,
    schemaRef,
  });
