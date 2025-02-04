import type { OperationSchema as IOperationSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

export class OperationSchema extends Schema implements IOperationSchema {
  public constructor(
    public traits: SchemaTraits,
    public input: SchemaRef,
    public output: SchemaRef,
  ) {
    super(traits);
  }
}

export function op(
  name: string,
  traits: SchemaTraits = {},
  input: SchemaRef,
  output: SchemaRef,
): OperationSchema {
  const schema = new OperationSchema(traits, input, output);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
