import type { SchemaTraits, TraitsSchema } from "@smithy/types";

/**
 * @internal
 */
export abstract class Schema implements TraitsSchema {
  protected constructor(
    public name: string,
    public traits: SchemaTraits
  ) {}
}
