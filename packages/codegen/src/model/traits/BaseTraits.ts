import { Nodes } from "../node/Nodes";
import type { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * A trait whose value is an empty object.
 *
 * @internal
 */
export abstract class AnnotationTrait extends Trait {
  protected constructor(id: ShapeId, value: unknown) {
    super(id, value === undefined || value === null ? {} : value);
  }
}

/**
 * A trait whose value is a single string.
 *
 * @internal
 */
export abstract class StringTrait extends Trait {
  private readonly _stringValue: string;

  protected constructor(id: ShapeId, value: unknown) {
    super(id, value);
    this._stringValue = Nodes.expectString(value, "Expected a string value for trait `" + id + "`");
  }

  public getValue(): string {
    return this._stringValue;
  }
}

/**
 * A trait whose value is a list of strings.
 */
export abstract class StringListTrait extends Trait {
  private readonly _values: string[];

  protected constructor(id: ShapeId, value: unknown) {
    super(id, value);
    this._values = Nodes.expectStringArray(value);
  }

  public getValues(): string[] {
    return this._values;
  }
}

/**
 * A trait for which no typed class exists.
 */
export class DynamicTrait extends Trait {
  constructor(id: ShapeId, value: unknown) {
    super(id, value);
  }
}
