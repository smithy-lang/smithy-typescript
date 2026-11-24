import type { Model } from "../Model";

/**
 * Determines whether members are optional using Smithy IDL 2.0 nullability rules.
 *
 * @internal
 */
export class NullableIndex {
  private readonly _model: Model;

  constructor(model: Model) {
    this._model = model;
  }

  public static of(model: Model): NullableIndex {
    return model.getKnowledge(NullableIndex);
  }
}
