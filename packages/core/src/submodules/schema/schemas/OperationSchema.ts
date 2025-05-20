import type { OperationSchema as IOperationSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * This is used as a reference container for the input/output pair of schema, and for trait
 * detection on the operation that may affect client protocol logic.
 *
 * @alpha
 */
export class OperationSchema extends Schema implements IOperationSchema {
  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public input: SchemaRef,
    public output: SchemaRef
  ) {
    super(name, traits);
  }
}

/**
 * Factory for OperationSchema.
 * @internal
 */
export function op(
  namespace: string,
  name: string,
  traits: SchemaTraits = {},
  input: SchemaRef,
  output: SchemaRef
): OperationSchema {
  const schema = new OperationSchema(namespace + "#" + name, traits, input, output);
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
