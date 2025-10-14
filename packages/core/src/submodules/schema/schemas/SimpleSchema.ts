import type { SchemaRef, SchemaTraits, TraitsSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * Although numeric values exist for most simple schema, this class is used for cases where traits are
 * attached to those schema, since a single number cannot easily represent both a schema and its traits.
 *
 * @alpha
 * @deprecated use StaticSchema
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
 * @deprecated use StaticSchema
 */
export const sim = (namespace: string, name: string, schemaRef: SchemaRef, traits: SchemaTraits) =>
  Schema.assign(new SimpleSchema(), {
    name,
    namespace,
    traits,
    schemaRef,
  });

/**
 * @internal
 * @deprecated
 */
export const simAdapter = (namespace: string, name: string, traits: SchemaTraits, schemaRef: SchemaRef) =>
  Schema.assign(new SimpleSchema(), {
    name,
    namespace,
    traits,
    schemaRef,
  });
