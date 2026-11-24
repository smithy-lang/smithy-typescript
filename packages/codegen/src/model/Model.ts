import { ExpectationNotMetException } from "./exceptions/exceptions";
import { StructureShape } from "./shapes/AggregateShapes";
import { OperationShape, ResourceShape, ServiceShape } from "./shapes/ServiceShapes";
import type { Shape } from "./shapes/Shape";
import type { ShapeId, ToShapeId } from "./shapes/ShapeId";
import { isTraitClass } from "./traits/Trait";
import type { Trait, TraitClass } from "./traits/Trait";

type ShapeClass<T extends Shape> = abstract new (...args: never[]) => T;

type KnowledgeIndexConstructor<T> = new (model: Model, ...rest: never[]) => T;

const KNOWLEDGE = new WeakMap<Model, Map<unknown, unknown>>();

/**
 * An immutable collection of shapes and metadata, including the member shapes of aggregates.
 *
 * @internal
 */
export class Model {
  private readonly _metadata: ReadonlyMap<string, unknown>;
  private readonly _shapeMap: Map<ShapeId, Shape>;
  private readonly _byClass = new Map<unknown, Shape[]>();
  private _allShapes: Shape[] | undefined;
  private _traitCache: Map<ShapeId, Shape[]> | undefined;

  constructor(shapes: readonly Shape[], metadata: ReadonlyMap<string, unknown> = new Map<string, unknown>()) {
    this._metadata = metadata;
    this._shapeMap = new Map<ShapeId, Shape>();
    for (const shape of shapes) {
      this._shapeMap.set(shape.getId(), shape);
      for (const member of shape.members()) {
        this._shapeMap.set(member.getId(), member);
      }
    }
  }

  public getMetadata(): ReadonlyMap<string, unknown> {
    return this._metadata;
  }

  public getShape(id: ToShapeId): Shape | undefined {
    return this._shapeMap.get(id.toShapeId());
  }

  public expectShape(id: ToShapeId): Shape;
  public expectShape<T extends Shape>(id: ToShapeId, type: ShapeClass<T>): T;
  public expectShape(id: ToShapeId, type?: ShapeClass<Shape>): Shape {
    const shapeId = id.toShapeId();
    const shape = this._shapeMap.get(shapeId);
    if (shape === undefined) {
      throw new ExpectationNotMetException("Shape not found: " + shapeId);
    }
    if (type !== undefined && !(shape instanceof type)) {
      const actual: Shape = shape;
      throw new ExpectationNotMetException(
        "Expected shape `" + shapeId + "` to be an instance of " + type.name + ", but found " + actual.getType()
      );
    }
    return shape;
  }

  /**
   * Returns all shapes, including member shapes, in insertion order.
   */
  public toSet(): readonly Shape[] {
    if (this._allShapes === undefined) {
      this._allShapes = Array.from(this._shapeMap.values());
    }
    return this._allShapes;
  }

  public shapes(): readonly Shape[];
  public shapes<T extends Shape>(shapeType: ShapeClass<T>): readonly T[];
  public shapes(shapeType?: ShapeClass<Shape>): readonly Shape[] {
    return shapeType === undefined ? this.toSet() : this._ofClass(shapeType);
  }

  public getShapesWithTrait(trait: ToShapeId | TraitClass<Trait>): readonly Shape[] {
    const cache = this._getTraitCache();
    if (isTraitClass(trait)) {
      const result: Shape[] = [];
      for (const shapes of [cache.get(trait.ID), ...(trait.ALIASES ?? []).map((alias) => cache.get(alias))]) {
        if (shapes !== undefined) {
          result.push(...shapes);
        }
      }
      return result;
    }
    return cache.get((trait as ToShapeId).toShapeId()) ?? [];
  }

  public getOperationShapes(): readonly OperationShape[] {
    return this._ofClass(OperationShape);
  }

  public getResourceShapes(): readonly ResourceShape[] {
    return this._ofClass(ResourceShape);
  }

  public getServiceShapes(): readonly ServiceShape[] {
    return this._ofClass(ServiceShape);
  }

  public getStructureShapes(): readonly StructureShape[] {
    return this._ofClass(StructureShape);
  }

  public getOperationShapesWithTrait(trait: TraitClass<Trait>): OperationShape[] {
    return this._withTrait(this.getOperationShapes(), trait);
  }

  public getStructureShapesWithTrait(trait: TraitClass<Trait>): StructureShape[] {
    return this._withTrait(this.getStructureShapes(), trait);
  }

  /**
   * Returns the knowledge index of the given type, creating and caching it on first use.
   */
  public getKnowledge<T>(type: KnowledgeIndexConstructor<T>, factory?: (model: Model) => T): T {
    let indexes = KNOWLEDGE.get(this);
    if (indexes === undefined) {
      indexes = new Map<unknown, unknown>();
      KNOWLEDGE.set(this, indexes);
    }
    let index = indexes.get(type) as T | undefined;
    if (index === undefined) {
      index = factory === undefined ? new type(this) : factory(this);
      indexes.set(type, index);
    }
    return index;
  }

  private _ofClass<T extends Shape>(shapeClass: ShapeClass<T>): T[] {
    let result = this._byClass.get(shapeClass) as T[] | undefined;
    if (result === undefined) {
      result = [];
      for (const shape of this._shapeMap.values()) {
        if (shape instanceof shapeClass) {
          result.push(shape);
        }
      }
      this._byClass.set(shapeClass, result);
    }
    return result;
  }

  private _withTrait<T extends Shape>(shapes: readonly T[], trait: TraitClass<Trait>): T[] {
    return shapes.filter((shape) => shape.hasTrait(trait));
  }

  private _getTraitCache(): Map<ShapeId, Shape[]> {
    if (this._traitCache === undefined) {
      const cache = new Map<ShapeId, Shape[]>();
      for (const shape of this._shapeMap.values()) {
        for (const traitId of shape.getAllTraits().keys()) {
          const shapes = cache.get(traitId);
          if (shapes === undefined) {
            cache.set(traitId, [shape]);
          } else {
            shapes.push(shape);
          }
        }
      }
      this._traitCache = cache;
    }
    return this._traitCache;
  }
}
