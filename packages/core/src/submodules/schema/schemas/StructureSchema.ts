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
        : [memberList[i], 0];
    }
  }
}

export function struct(
  namespace: string,
  name: string,
  traits: SchemaTraits,
  memberNames: string[],
  memberList: SchemaRef[]
): StructureSchema {
  const schema = new StructureSchema(namespace + "#" + name, traits, memberNames, memberList);
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
