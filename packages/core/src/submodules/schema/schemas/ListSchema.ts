import type { ListSchema as IListSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { Schema } from "./Schema";

/**
 * A schema with a single member schema.
 * The deprecated Set type may be represented as a list.
 *
 * @alpha
 */
export class ListSchema extends Schema implements IListSchema {
  public static readonly symbol = Symbol.for("@smithy/lis");
  public name!: string;
  public traits!: SchemaTraits;
  public valueSchema!: SchemaRef;
  protected readonly symbol = ListSchema.symbol;
}

/**
 * Factory for ListSchema.
 *
 * @internal
 */
export const list = (namespace: string, name: string, traits: SchemaTraits, valueSchema: SchemaRef): ListSchema =>
  Schema.assign(new ListSchema(), {
    name,
    namespace,
    traits,
    valueSchema,
  });
