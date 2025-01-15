import type { SchemaRef, SchemaTraits, StructureSchema as IStructureSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

export class StructureSchema extends Schema implements IStructureSchema {
  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public members: Record<string, [SchemaRef, SchemaTraits]>
  ) {
    super(name, traits);
  }
}

export function struct(
  name: string,
  traits: SchemaTraits = {},
  members: Record<string, [SchemaRef, SchemaTraits]> = {}
): StructureSchema {
  const schema = new StructureSchema(name, traits, members);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
