import type { MemberSchema, SchemaRef, SchemaTraits, StructureSchema as IStructureSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

export class StructureSchema extends Schema implements IStructureSchema {
  public members: Record<string, [SchemaRef, SchemaTraits]> = {};

  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public memberNames: string[],
    public memberList: SchemaRef[]
  ) {
    super(name, traits);
    for (let i = 0; i < memberNames.length; ++i) {
      this.members[memberNames[i]] = Array.isArray(memberList[i])
        ? (memberList[i] as MemberSchema)
        : [memberList[i], {}];
    }
  }
}

export function struct(
  name: string,
  traits: SchemaTraits = {},
  memberNames: string[],
  memberList: SchemaRef[]
): StructureSchema {
  const schema = new StructureSchema(name, traits, memberNames, memberList);
  if (TypeRegistry.active) {
    TypeRegistry.active.register(name, schema);
  }
  return schema;
}
