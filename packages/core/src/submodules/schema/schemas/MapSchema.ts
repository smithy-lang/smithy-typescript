import type { MapSchema as IMapSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { Schema } from "./Schema";

/**
 * A schema with a key schema and value schema.
 * @internal
 * @deprecated use StaticSchema
 */
export class MapSchema extends Schema implements IMapSchema {
  public static readonly symbol = Symbol.for("@smithy/map");
  public name!: string;
  public traits!: SchemaTraits;
  /**
   * This is expected to be StringSchema, but may have traits.
   */
  public keySchema!: SchemaRef;
  public valueSchema!: SchemaRef;
  protected readonly symbol = MapSchema.symbol;
}

/**
 * Factory for MapSchema.
 * @internal
 * @deprecated use StaticSchema
 */
export const map = (
  namespace: string,
  name: string,
  traits: SchemaTraits,
  keySchema: SchemaRef,
  valueSchema: SchemaRef
): MapSchema =>
  Schema.assign(new MapSchema(), {
    name,
    namespace,
    traits,
    keySchema,
    valueSchema,
  });
