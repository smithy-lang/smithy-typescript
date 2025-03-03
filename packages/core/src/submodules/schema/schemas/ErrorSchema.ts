import type { SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { StructureSchema } from "./StructureSchema";

export class ErrorSchema extends StructureSchema {
  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public memberNames: string[],
    public memberList: SchemaRef[],
    /**
     * Constructor for a modeled service exception class that extends Error.
     */
    public ctor: any
  ) {
    super(name, traits, memberNames, memberList);
  }
}

export function error(
  name: string,
  traits: SchemaTraits = {},
  memberNames: string[],
  memberList: SchemaRef[],
  ctor: any
): ErrorSchema {
  const schema = new ErrorSchema(name, traits, memberNames, memberList, ctor);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
