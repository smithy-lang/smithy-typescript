import type { MemberSchema, SchemaRef, SchemaTraits, TraitsSchema } from "@smithy/types";

import { deref } from "../deref";

/**
 * @internal
 */
export abstract class Schema implements TraitsSchema {
  protected constructor(
    public name: string,
    public traits: SchemaTraits
  ) {}

  public static isMemberSchema(schema: SchemaRef): schema is MemberSchema {
    return Array.isArray(deref(schema));
  }
}
