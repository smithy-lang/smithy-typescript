import type { Model } from "../Model";
import { NeighborProviderIndex } from "./NeighborProviderIndex";
import { Walker } from "../neighbor/Walker";
import type { Relationship } from "../neighbor/Relationship";
import { RelationshipTypes } from "../neighbor/RelationshipType";
import type { OperationShape, ResourceShape } from "../shapes/ServiceShapes";
import type { Shape } from "../shapes/Shape";
import type { ShapeId, ToShapeId } from "../shapes/ShapeId";
import { TreeSet } from "../utils/TreeSet";

/**
 * Indexes the operations and resources that are contained by services and resources.
 *
 * @internal
 */
export class TopDownIndex {
  private readonly _resources = new Map<ShapeId, ResourceShape[]>();
  private readonly _operations = new Map<ShapeId, OperationShape[]>();
  private readonly _sortedResources = new Map<ShapeId, ResourceShape[]>();
  private readonly _sortedOperations = new Map<ShapeId, OperationShape[]>();

  constructor(model: Model) {
    const walker = new Walker(NeighborProviderIndex.of(model).getProvider());
    const filter = (relationship: Relationship): boolean => {
      const type = relationship.getRelationshipType();
      return type === "RESOURCE" || RelationshipTypes.isOperationBinding(type);
    };
    for (const resource of model.getResourceShapes()) {
      this._findContained(resource.getId(), walker.walkShapes(resource, filter));
    }
    for (const service of model.getServiceShapes()) {
      this._findContained(service.getId(), walker.walkShapes(service, filter));
    }
  }

  public static of(model: Model): TopDownIndex {
    return model.getKnowledge(TopDownIndex);
  }

  /**
   * Returns the operations contained by a service or resource, sorted by shape ID unless `sorted` is false.
   */
  public getContainedOperations(entity: ToShapeId, sorted = true): readonly OperationShape[] {
    const source = sorted ? this._sortedOperations : this._operations;
    return source.get(entity.toShapeId()) ?? [];
  }

  private _findContained(container: ShapeId, shapes: readonly Shape[]): void {
    const containedResources: ResourceShape[] = [];
    const containedOperations: OperationShape[] = [];
    for (const shape of shapes) {
      if (shape.getId() !== container) {
        const resource = shape.asResourceShape();
        const operation = shape.asOperationShape();
        if (resource !== undefined) {
          containedResources.push(resource);
        } else if (operation !== undefined) {
          containedOperations.push(operation);
        }
      }
    }
    this._operations.set(container, containedOperations);
    this._resources.set(container, containedResources);
    this._sortedOperations.set(container, [...new TreeSet(containedOperations)]);
    this._sortedResources.set(container, [...new TreeSet(containedResources)]);
  }
}
