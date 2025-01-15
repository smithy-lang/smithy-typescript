import type { ListSchema as IListSchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

export class ListSchema extends Schema implements IListSchema {
  public constructor(
    public traits: SchemaTraits,
    public valueSchema: SchemaRef
  ) {
    super(traits);
  }
}

export function list(name: string, traits: SchemaTraits = {}, valueSchema: SchemaRef = void 0): ListSchema {
  const schema = new ListSchema(traits, typeof valueSchema === "function" ? valueSchema() : valueSchema);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
