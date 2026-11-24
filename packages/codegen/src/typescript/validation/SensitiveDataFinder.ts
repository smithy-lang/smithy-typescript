import type { Model, Shape } from "../../model";
import { SensitiveTrait, StreamingTrait, Walker } from "../../model";

/**
 * Finds sensitive or streaming data in the shapes reachable from a shape.
 */
export class SensitiveDataFinder {
  private readonly _cache = new Map<Shape, boolean>();
  private readonly _model: Model;

  public constructor(model: Model) {
    this._model = model;
  }

  public findsSensitiveDataIn(shape: Shape): boolean {
    const found = this._findRecursive(shape);
    this._cache.set(shape, found);
    return found;
  }

  private _findRecursive(shape: Shape): boolean {
    const cached = this._cache.get(shape);
    if (cached !== undefined) {
      return cached;
    }
    if (shape.hasTrait(SensitiveTrait) || shape.hasTrait(StreamingTrait)) {
      this._cache.set(shape, true);
      return true;
    }
    if (
      shape.getMemberTrait(this._model, SensitiveTrait) !== undefined ||
      shape.getMemberTrait(this._model, StreamingTrait) !== undefined
    ) {
      this._cache.set(shape, true);
      return true;
    }
    for (const reachable of Walker.walkShapes(this._model, shape)) {
      if (reachable !== shape && (reachable.hasTrait(SensitiveTrait) || reachable.hasTrait(StreamingTrait))) {
        this._cache.set(shape, true);
        return true;
      }
    }
    const map = shape.asMapShape();
    if (map !== undefined) {
      return this._findRecursive(map.getKey()) || this._findRecursive(map.getValue());
    }
    this._cache.set(shape, false);
    return false;
  }
}
