import type { MemberSchema, SchemaRef, SchemaTraits, StructureSchema as IStructureSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { Schema } from "./Schema";

/**
 * A structure schema has a known list of members. This is also used for unions.
 *
 * @alpha
 */
export class StructureSchema extends Schema implements IStructureSchema {
  public static symbol = Symbol.for("@smithy/str");
  public name!: string;
  public traits!: SchemaTraits;
  public memberNames!: string[];
  public memberList!: SchemaRef[];
  protected readonly symbol = StructureSchema.symbol;
}

/**
 * Factory for StructureSchema.
 *
 * @internal
 */
export const struct = (
  namespace: string,
  name: string,
  traits: SchemaTraits,
  memberNames: string[],
  memberList: SchemaRef[]
): StructureSchema =>
  Schema.assign(new StructureSchema(), {
    name,
    namespace,
    traits,
    memberNames,
    memberList,
  });
