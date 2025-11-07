import type { OperationSchema as IOperationSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { Schema } from "./Schema";

/**
 * This is used as a reference container for the input/output pair of schema, and for trait
 * detection on the operation that may affect client protocol logic.
 *
 * @internal
 * @deprecated use StaticSchema
 */
export class OperationSchema extends Schema implements IOperationSchema {
  public static readonly symbol = Symbol.for("@smithy/ope");
  public name!: string;
  public traits!: SchemaTraits;
  public input!: SchemaRef;
  public output!: SchemaRef;
  protected readonly symbol = OperationSchema.symbol;
}

/**
 * Factory for OperationSchema.
 * @internal
 * @deprecated use StaticSchema
 */
export const op = (
  namespace: string,
  name: string,
  traits: SchemaTraits,
  input: SchemaRef,
  output: SchemaRef
): OperationSchema =>
  Schema.assign(new OperationSchema(), {
    name,
    namespace,
    traits,
    input,
    output,
  });
