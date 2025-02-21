import type { SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { StructureSchema } from "./StructureSchema";

export class ErrorSchema extends StructureSchema {
  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public members: Record<string, [SchemaRef, SchemaTraits]>,
    /**
     * Constructor for a modeled service exception class that extends Error.
     */
    public ctor: any
  ) {
    super(name, traits, members);
  }
}

export function error(
  name: string,
  traits: SchemaTraits = {},
  members: Record<string, [SchemaRef, SchemaTraits]> = {},
  ctor: any
): ErrorSchema {
  const schema = new ErrorSchema(name, traits, members, ctor);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
