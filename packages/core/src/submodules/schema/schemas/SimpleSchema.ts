import { SchemaRef, SchemaTraits, TraitsSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

export class SimpleSchema extends Schema implements TraitsSchema {
  public constructor(
    public name: string,
    public schemaRef: SchemaRef,
    public traits: SchemaTraits
  ) {
    super(name, traits);
  }
}

export function sim(name: string, schemaRef: SchemaRef, traits: SchemaTraits) {
  const schema = new SimpleSchema(name, schemaRef, traits);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
