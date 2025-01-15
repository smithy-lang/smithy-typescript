import type { OperationSchema as IOperationSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

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
