import type { SchemaTraits, TraitsSchema } from "@smithy/types";

/**
 * Abstract base for class-based Schema except NormalizedSchema.
 *
 * @alpha
 */
export abstract class Schema implements TraitsSchema {
  protected constructor(
    public name: string,
    public traits: SchemaTraits
  ) {}
}
