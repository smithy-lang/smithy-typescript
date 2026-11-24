import { NeighborProviderIndex, Prelude, TreeMap, TreeSet } from "../model";
import type { NeighborProvider, Model, Relationship, Shape } from "../model";

/**
 * Orders shapes so that dependencies come before their dependents, with recursive shapes last.
 */
export class TopologicalIndex {
  private readonly _shapes = new Set<Shape>();
  private readonly _recursiveShapes = new Map<Shape, Set<string>>();

  public constructor(model: Model) {
    const sorted = new TreeSet(model.shapes().filter((shape) => !Prelude.isPreludeShape(shape)));
    const frequencyMap = new TreeMap<number, Map<Shape, Set<string>>>();
    const provider = NeighborProviderIndex.of(model).getProvider();

    for (const shape of sorted) {
      const paths = this._explore(shape, [], new Set(), provider);
      if (paths.size > 0) {
        let edges = 0;
        for (const path of paths.values()) {
          edges += path.length;
        }
        let bucket = frequencyMap.get(edges);
        if (bucket === undefined) {
          bucket = new Map();
          frequencyMap.set(edges, bucket);
        }
        bucket.set(shape, new Set(paths.keys()));
      }
    }
    for (const bucket of frequencyMap.values()) {
      for (const [shape, paths] of bucket) {
        this._recursiveShapes.set(shape, paths);
      }
    }
  }

  public static of(model: Model): TopologicalIndex {
    return model.getKnowledge(TopologicalIndex, (m) => new TopologicalIndex(m));
  }

  public getOrderedShapes(): ReadonlySet<Shape> {
    return this._shapes;
  }

  public getRecursiveShapes(): Iterable<Shape> {
    return this._recursiveShapes.keys();
  }

  private _explore(
    shape: Shape,
    path: Relationship[],
    visited: Set<Shape>,
    provider: NeighborProvider
  ): Map<string, Relationship[]> {
    if (visited.has(shape)) {
      return new Map([[path.map(String).join("|"), path]]);
    }
    const newVisited = new Set(visited);
    newVisited.add(shape);

    const sortedEdges = new TreeMap<Shape, Relationship>();
    for (const rel of provider.getNeighbors(shape)) {
      if (rel.getDirection() === "DIRECTED") {
        const neighbor = rel.getNeighborShape();
        if (!rel.getNeighborShapeId().equals(shape.getId()) && neighbor !== undefined) {
          sortedEdges.set(neighbor, rel);
        }
      }
    }
    if (sortedEdges.size === 0) {
      this._shapes.add(shape);
      return new Map();
    }

    const recursivePaths = new Map<string, Relationship[]>();
    for (const [neighbor, rel] of sortedEdges) {
      for (const [key, value] of this._explore(neighbor, [...path, rel], newVisited, provider)) {
        recursivePaths.set(key, value);
      }
    }
    if (recursivePaths.size === 0) {
      this._shapes.add(shape);
    }
    return recursivePaths;
  }
}
