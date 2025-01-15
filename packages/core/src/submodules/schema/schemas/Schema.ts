import type { MemberSchema, SchemaTraits, TraitsSchema } from "@smithy/types";

/**
 * @internal
 */
export abstract class Schema implements TraitsSchema {
  protected constructor(public traits: SchemaTraits) {}

  public static isMemberSchema(schema: unknown): schema is MemberSchema {
    return Array.isArray(schema);
  }
}
