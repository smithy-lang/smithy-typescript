import type { ShapeId } from "../shapes/ShapeId";

/**
 * A constructor-side view of a trait class, used to look traits up by class.
 *
 * @internal
 */
export interface TraitClass<T extends Trait> {
  readonly ID: ShapeId;
  readonly ALIASES?: readonly ShapeId[];
  readonly prototype: T;
}

/**
 * Base class of all traits. The raw JSON value is available through `toNode`.
 *
 * @internal
 */
export abstract class Trait {
  private readonly _id: ShapeId;
  private readonly _value: unknown;

  protected constructor(id: ShapeId, value: unknown) {
    this._id = id;
    this._value = value;
  }

  public toShapeId(): ShapeId {
    return this._id;
  }

  public toNode(): unknown {
    return this._value;
  }
}

export function isTraitClass(value: unknown): value is TraitClass<Trait> {
  return typeof value === "function";
}

/**
 * Prefixes IDs that omit a namespace with the prelude namespace.
 *
 * @internal
 */
export function makeAbsoluteTraitName(name: string): string {
  return name.indexOf("#") === -1 ? "smithy.api#" + name : name;
}
