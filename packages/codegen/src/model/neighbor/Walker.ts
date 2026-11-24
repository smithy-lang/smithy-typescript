import type { Model } from "../Model";
import type { Shape } from "../shapes/Shape";
import type { ShapeId } from "../shapes/ShapeId";
import { NeighborProviderIndex } from "../knowledge/NeighborProviderIndex";
import type { NeighborProvider } from "./NeighborProvider";
import type { Relationship } from "./Relationship";

type RelationshipPredicate = (relationship: Relationship) => boolean;

/**
 * Walks the shapes reachable from a starting shape, in the same order as Smithy's Walker.
 *
 * @internal
 */
export class Walker {
  private readonly _provider: NeighborProvider;

  constructor(modelOrProvider: Model | NeighborProvider) {
    this._provider =
      "getNeighbors" in modelOrProvider
        ? modelOrProvider
        : NeighborProviderIndex.of(modelOrProvider as Model).getProvider();
  }

  /**
   * Walks the shapes reachable from a shape using the model's default neighbor provider.
   */
  public static walkShapes(model: Model, shape: Shape, predicate?: RelationshipPredicate): Shape[] {
    return new Walker(model).walkShapes(shape, predicate);
  }

  public walkShapes(shape: Shape, predicate?: RelationshipPredicate): Shape[] {
    return Array.from(this.iterateShapes(shape, predicate));
  }

  public *iterateShapes(shape: Shape, predicate?: RelationshipPredicate): IterableIterator<Shape> {
    const traversed = new Set<ShapeId>([shape.getId()]);
    const queue: Relationship[] = [];
    let head = 0;
    this._pushNeighbors(queue, shape, predicate);
    yield shape;
    while (head < queue.length) {
      const relationship = queue[head++];
      if (!traversed.has(relationship.getNeighborShapeId())) {
        traversed.add(relationship.getNeighborShapeId());
        const neighbor = relationship.getNeighborShape() as Shape;
        this._pushNeighbors(queue, neighbor, predicate);
        yield neighbor;
      }
    }
  }

  private _pushNeighbors(queue: Relationship[], shape: Shape, predicate: RelationshipPredicate | undefined): void {
    for (const relationship of this._provider.getNeighbors(shape)) {
      if (relationship.getNeighborShape() !== undefined && (predicate === undefined || predicate(relationship))) {
        queue.push(relationship);
      }
    }
  }
}
