import type { ListSchema as IListSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

export class ListSchema extends Schema implements IListSchema {
  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public valueSchema: SchemaRef
  ) {
    super(name, traits);
  }
}

export function list(namespace: string, name: string, traits: SchemaTraits = {}, valueSchema: SchemaRef): ListSchema {
  const schema = new ListSchema(
    namespace + "#" + name,
    traits,
    typeof valueSchema === "function" ? valueSchema() : valueSchema
  );
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
