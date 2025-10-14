import type { SchemaTraits, TraitsSchema } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";

/**
 * Abstract base for class-based Schema except NormalizedSchema.
 *
 * @alpha
 * @deprecated use StaticSchema
 */
export abstract class Schema implements TraitsSchema {
  public name!: string;
  public namespace!: string;
  public traits!: SchemaTraits;
  protected abstract readonly symbol: symbol;

  public static assign<T extends Schema>(instance: T, values: Omit<T, "getName" | "symbol">): T {
    const schema = Object.assign(instance, values);
    // TypeRegistry.for(schema.namespace).register(schema.name, schema);
    return schema;
  }

  public static [Symbol.hasInstance](lhs: unknown) {
    const isPrototype = this.prototype.isPrototypeOf(lhs as any);
    if (!isPrototype && typeof lhs === "object" && lhs !== null) {
      const list = lhs as any;
      return list.symbol === (this as any).symbol;
    }
    return isPrototype;
  }

  public getName(): string {
    return this.namespace + "#" + this.name;
  }
}
