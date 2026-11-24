import type { Model, Shape } from "../../model";
import { SchemaTraitFilterIndex } from "./SchemaTraitFilterIndex";

/**
 * Tells whether a shape is rendered as a reference to another schema.
 */
export class SchemaReferenceIndex {
  public readonly traits: SchemaTraitFilterIndex;
  private readonly _model: Model;

  public constructor(model: Model) {
    this._model = model;
    this.traits = SchemaTraitFilterIndex.of(model);
  }

  public static of(model: Model): SchemaReferenceIndex {
    return model.getKnowledge(SchemaReferenceIndex, (m) => new SchemaReferenceIndex(m));
  }

  public isReferenceSchema(shape: Shape): boolean {
    let targetShape = shape;
    const member = shape.asMemberShape();
    if (member !== undefined) {
      targetShape = this._model.expectShape(member.getTarget());
    }
    switch (targetShape.getType()) {
      case "string":
      case "boolean":
      case "byte":
      case "double":
      case "float":
      case "short":
      case "integer":
      case "long":
      case "enum":
      case "intEnum":
      case "bigInteger":
      case "bigDecimal":
      case "timestamp":
      case "blob":
      case "document":
        return false;
      case "list":
      case "set": {
        const collection = shape.asListShape() ?? shape.asSetShape();
        return collection !== undefined ? this.isReferenceSchema(collection.getMember()) : true;
      }
      case "map": {
        const map = shape.asMapShape();
        return map !== undefined ? this.isReferenceSchema(map.getValue()) : true;
      }
      default:
        return true;
    }
  }
}
