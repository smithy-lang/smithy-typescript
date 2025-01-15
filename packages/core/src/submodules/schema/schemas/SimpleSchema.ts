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

export function sim(namespace: string, name: string, schemaRef: SchemaRef, traits: SchemaTraits) {
  const schema = new SimpleSchema(namespace + "#" + name, schemaRef, traits);
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
