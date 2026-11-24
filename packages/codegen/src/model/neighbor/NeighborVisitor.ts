import type { Model } from "../Model";
import { ShapeVisitorDefault } from "../shapes/ShapeVisitor";
import type { ListShape, MapShape, SetShape, StructureShape, UnionShape } from "../shapes/AggregateShapes";
import type { MemberShape } from "../shapes/MemberShape";
import type { OperationShape, ResourceShape, ServiceShape } from "../shapes/ServiceShapes";
import type { Shape } from "../shapes/Shape";
import type { ShapeId } from "../shapes/ShapeId";
import type { EnumShape, IntEnumShape } from "../shapes/SimpleShapes";
import { Relationship } from "./Relationship";
import type { RelationshipType } from "./RelationshipType";
import type { NeighborProvider } from "./NeighborProvider";

/**
 * Computes the structural relationships of a shape, mirroring Smithy's NeighborVisitor.
 */
export class NeighborVisitor extends ShapeVisitorDefault<Relationship[]> implements NeighborProvider {
  private readonly _model: Model;

  constructor(model: Model) {
    super();
    this._model = model;
  }

  public getNeighbors(shape: Shape): readonly Relationship[] {
    return shape.accept(this);
  }

  public serviceShape(shape: ServiceShape): Relationship[] {
    const result = this._initializeRelationships(shape);
    for (const operation of shape.getOperations()) {
      this._push(result, shape, "OPERATION", operation);
    }
    for (const resource of shape.getResources()) {
      this._push(result, shape, "RESOURCE", resource);
    }
    for (const errorId of shape.getErrorsSet()) {
      this._push(result, shape, "ERROR", errorId);
    }
    return result;
  }

  public resourceShape(shape: ResourceShape): Relationship[] {
    const result = this._initializeRelationships(shape);
    shape.getIdentifiers().forEach((id) => this._push(result, shape, "IDENTIFIER", id));
    shape.getProperties().forEach((id) => this._push(result, shape, "PROPERTY", id));
    shape.getResources().forEach((id) => this._push(result, shape, "RESOURCE", id));
    this._pushOptional(result, shape, "LIST", shape.getList());
    this._pushOptional(result, shape, "CREATE", shape.getCreate());
    this._pushOptional(result, shape, "PUT", shape.getPut());
    this._pushOptional(result, shape, "READ", shape.getRead());
    this._pushOptional(result, shape, "UPDATE", shape.getUpdate());
    this._pushOptional(result, shape, "DELETE", shape.getDelete());
    shape.getOperations().forEach((id) => this._push(result, shape, "OPERATION", id));
    shape.getCollectionOperations().forEach((id) => this._push(result, shape, "COLLECTION_OPERATION", id));
    return result;
  }

  public operationShape(shape: OperationShape): Relationship[] {
    const result = this._initializeRelationships(shape);
    this._pushOptional(result, shape, "INPUT", shape.getInput());
    this._pushOptional(result, shape, "OUTPUT", shape.getOutput());
    for (const errorId of shape.getErrorsSet()) {
      this._push(result, shape, "ERROR", errorId);
    }
    return result;
  }

  public memberShape(shape: MemberShape): Relationship[] {
    const container = this._model.getShape(shape.getContainer());
    const isEnum = container !== undefined && (container.isEnumShape() || container.isIntEnumShape());
    const result = this._initializeRelationships(shape);
    this._push(result, shape, "MEMBER_CONTAINER", shape.getContainer());
    if (!isEnum) {
      this._push(result, shape, "MEMBER_TARGET", shape.getTarget());
    }
    return result;
  }

  public enumShape(shape: EnumShape): Relationship[] {
    return this._pushMembers(shape, "ENUM_MEMBER");
  }

  public intEnumShape(shape: IntEnumShape): Relationship[] {
    return this._pushMembers(shape, "INT_ENUM_MEMBER");
  }

  public listShape(shape: ListShape): Relationship[] {
    const result = this._initializeRelationships(shape);
    result.push(Relationship.create(shape, "LIST_MEMBER", shape.getMember()));
    return result;
  }

  public setShape(shape: SetShape): Relationship[] {
    const result = this._initializeRelationships(shape);
    result.push(Relationship.create(shape, "SET_MEMBER", shape.getMember()));
    return result;
  }

  public mapShape(shape: MapShape): Relationship[] {
    const result = this._initializeRelationships(shape);
    result.push(Relationship.create(shape, "MAP_KEY", shape.getKey()));
    result.push(Relationship.create(shape, "MAP_VALUE", shape.getValue()));
    return result;
  }

  public structureShape(shape: StructureShape): Relationship[] {
    return this._pushMembers(shape, "STRUCTURE_MEMBER");
  }

  public unionShape(shape: UnionShape): Relationship[] {
    return this._pushMembers(shape, "UNION_MEMBER");
  }

  protected getDefault(shape: Shape): Relationship[] {
    return shape.getMixins().length === 0 ? [] : this._initializeRelationships(shape);
  }

  private _pushMembers(shape: Shape, type: RelationshipType): Relationship[] {
    const result = this._initializeRelationships(shape);
    for (const member of shape.getAllMembers().values()) {
      result.push(Relationship.create(shape, type, member));
    }
    return result;
  }

  private _initializeRelationships(shape: Shape): Relationship[] {
    const result: Relationship[] = [];
    if (!shape.isMemberShape()) {
      for (const mixin of shape.getMixins()) {
        this._push(result, shape, "MIXIN", mixin);
      }
    }
    return result;
  }

  private _push(result: Relationship[], container: Shape, type: RelationshipType, target: ShapeId): void {
    const neighbor = this._model.getShape(target);
    result.push(
      neighbor === undefined
        ? Relationship.createInvalid(container, type, target)
        : Relationship.create(container, type, neighbor)
    );
  }

  private _pushOptional(
    result: Relationship[],
    container: Shape,
    type: RelationshipType,
    target: ShapeId | undefined
  ): void {
    if (target !== undefined) {
      this._push(result, container, type, target);
    }
  }
}
