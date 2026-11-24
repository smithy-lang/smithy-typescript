import type { Shape } from "../shapes/Shape";
import type { ShapeId } from "../shapes/ShapeId";
import { RelationshipTypes } from "./RelationshipType";
import type { RelationshipDirection, RelationshipType } from "./RelationshipType";

/**
 * An edge between a shape and a neighbor, which is absent when the neighbor ID does not resolve.
 *
 * @internal
 */
export class Relationship {
  private readonly _shape: Shape;
  private readonly _relationshipType: RelationshipType;
  private readonly _neighborShapeId: ShapeId;
  private readonly _neighborShape: Shape | undefined;

  private constructor(
    shape: Shape,
    relationshipType: RelationshipType,
    neighborShapeId: ShapeId,
    neighborShape: Shape | undefined
  ) {
    this._shape = shape;
    this._relationshipType = relationshipType;
    this._neighborShapeId = neighborShapeId;
    this._neighborShape = neighborShape;
  }

  public static create(shape: Shape, relationshipType: RelationshipType, neighborShape: Shape): Relationship {
    return new Relationship(shape, relationshipType, neighborShape.getId(), neighborShape);
  }

  public static createInvalid(
    shape: Shape,
    relationshipType: RelationshipType,
    neighborShapeId: ShapeId
  ): Relationship {
    return new Relationship(shape, relationshipType, neighborShapeId, undefined);
  }

  public getRelationshipType(): RelationshipType {
    return this._relationshipType;
  }

  public getNeighborShapeId(): ShapeId {
    return this._neighborShapeId;
  }

  public getNeighborShape(): Shape | undefined {
    return this._neighborShape;
  }

  public getDirection(): RelationshipDirection {
    return RelationshipTypes.getDirection(this._relationshipType);
  }

  public equals(other: unknown): boolean {
    return (
      other instanceof Relationship &&
      this._shape === other._shape &&
      this._relationshipType === other._relationshipType &&
      this._neighborShapeId === other._neighborShapeId
    );
  }

  public toString(): string {
    return (
      '[Relationship shape="' +
      this._shape.getId() +
      '" type="' +
      this._relationshipType +
      '" neighbor="' +
      this._neighborShapeId +
      '" neighborPresent=' +
      (this._neighborShape !== undefined) +
      "]"
    );
  }
}
