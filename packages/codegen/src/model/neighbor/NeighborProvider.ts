import type { Model } from "../Model";
import type { Shape } from "../shapes/Shape";
import type { ShapeId } from "../shapes/ShapeId";
import { NeighborVisitor } from "./NeighborVisitor";
import type { Relationship } from "./Relationship";

/**
 * Computes the relationships that leave a shape.
 *
 * @internal
 */
export interface NeighborProvider {
  getNeighbors(shape: Shape): readonly Relationship[];
}

/**
 * Factory functions for the standard {@link NeighborProvider} implementations.
 *
 * @internal
 */
export class NeighborProviders {
  public static of(model: Model): NeighborProvider {
    return new NeighborVisitor(model);
  }

  public static precomputed(model: Model, provider: NeighborProvider = NeighborProviders.of(model)): NeighborProvider {
    const relationships = new Map<ShapeId, readonly Relationship[]>();
    for (const shape of model.toSet()) {
      relationships.set(shape.getId(), provider.getNeighbors(shape));
    }
    return { getNeighbors: (shape) => relationships.get(shape.getId()) ?? [] };
  }
}
