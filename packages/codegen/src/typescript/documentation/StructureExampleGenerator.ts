import {
  type EnumShape,
  type IntEnumShape,
  type ListShape,
  type MapShape,
  type MemberShape,
  type Model,
  RequiredTrait,
  type Shape,
  StreamingTrait,
  type StructureShape,
  type UnionShape,
} from "../../model";

/**
 * Generates the structural hint documentation of command inputs and outputs.
 */
export abstract class StructureExampleGenerator {
  public static generateStructuralHintDocumentation(
    shape: Shape,
    model: Model,
    isComment: boolean,
    isInput: boolean
  ): string {
    const buffer = new Buffer();
    shapeExample(shape, buffer, model, 0, new ShapeTracker(), isInput);
    const lines = buffer.toString().split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    const s = lines
      .map((line) => line.replace(/([\w",:[{] )\s+/g, "$1").replace(/\s+$/, ""))
      .join(isComment ? "\n// " : "\n");
    return (isComment ? "// " : "") + s.replace(/,$/, ";");
  }
}

class Buffer {
  private _value = "";

  public append(indentation: number, tail: string): void {
    this._value += " ".repeat(Math.max(indentation, 0)) + tail;
  }

  public toString(): string {
    return this._value;
  }
}

class ShapeTracker {
  private readonly _depths = new Map<Shape, Set<number>>();
  private readonly _occurrences = new Map<Shape, number>();

  public mark(shape: Shape, depth: number): void {
    let depths = this._depths.get(shape);
    if (depths === undefined) {
      depths = new Set();
      this._depths.set(shape, depths);
    }
    depths.add(depth);
    this._occurrences.set(shape, (this._occurrences.get(shape) ?? 0) + 1);
  }

  public shouldTruncate(shape: Shape): boolean {
    const aggregate =
      shape.isMapShape() ||
      shape.isUnionShape() ||
      shape.isStructureShape() ||
      shape.isListShape() ||
      shape.isSetShape();
    return aggregate && (this.getOccurrenceCount(shape) > 5 || this.getOccurrenceDepths(shape) > 2);
  }

  public getOccurrenceDepths(shape: Shape): number {
    return this._depths.get(shape)?.size ?? 0;
  }

  public getOccurrenceCount(shape: Shape): number {
    return this._occurrences.get(shape) ?? 0;
  }
}

const checkRequired = (indentation: number, buffer: Buffer, shape: Shape): void => {
  buffer.append(indentation, shape.hasTrait(RequiredTrait) ? " // required\n" : "\n");
};

const structure = (
  structureShape: StructureShape,
  buffer: Buffer,
  model: Model,
  indentation: number,
  tracker: ShapeTracker,
  isInput: boolean
): void => {
  if (structureShape.getAllMembers().size === 0) {
    buffer.append(indentation, "{},");
    checkRequired(indentation, buffer, structureShape);
    return;
  }
  buffer.append(
    indentation,
    "{" + (tracker.getOccurrenceCount(structureShape) === 1 ? " // " + structureShape.getId().getName() : "")
  );
  checkRequired(indentation, buffer, structureShape);
  for (const member of structureShape.getAllMembers().values()) {
    buffer.append(indentation + 2, member.getMemberName() + ": ");
    shapeExample(member, buffer, model, indentation + 2, tracker, isInput);
  }
  buffer.append(indentation, "},\n");
};

const union = (
  unionShape: UnionShape,
  buffer: Buffer,
  model: Model,
  indentation: number,
  tracker: ShapeTracker,
  isInput: boolean
): void => {
  buffer.append(
    indentation,
    "{" +
      (tracker.getOccurrenceCount(unionShape) === 1 ? " // " + unionShape.getId().getName() : "// ") +
      " Union: only one key present"
  );
  checkRequired(indentation, buffer, unionShape);
  for (const member of unionShape.getAllMembers().values()) {
    buffer.append(indentation + 2, member.getMemberName() + ": ");
    shapeExample(member, buffer, model, indentation + 2, tracker, isInput);
  }
  buffer.append(indentation, "},\n");
};

const shapeExample = (
  shape: Shape,
  buffer: Buffer,
  model: Model,
  indentation: number,
  tracker: ShapeTracker,
  isInput: boolean
): void => {
  const asMember = shape.asMemberShape();
  const target: Shape = asMember !== undefined ? model.getShape((asMember as MemberShape).getTarget())! : shape;
  tracker.mark(target, indentation);
  if (tracker.shouldTruncate(target)) {
    buffer.append(indentation, `"<${target.getId().getName()}>",`);
    checkRequired(indentation, buffer, shape);
    return;
  }
  switch (target.getType()) {
    case "bigDecimal":
      buffer.append(indentation, 'Number("bigdecimal"),');
      break;
    case "bigInteger":
      buffer.append(indentation, 'Number("bigint"),');
      break;
    case "blob":
      if (isInput) {
        buffer.append(
          indentation,
          target.hasTrait(StreamingTrait)
            ? '"MULTIPLE_TYPES_ACCEPTED", // see \\@smithy/types -> StreamingBlobPayloadInputTypes'
            : 'new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")'
        );
      } else {
        buffer.append(
          indentation,
          target.hasTrait(StreamingTrait)
            ? '"<SdkStream>", // see \\@smithy/types -> StreamingBlobPayloadOutputTypes'
            : "new Uint8Array(),"
        );
      }
      break;
    case "boolean":
      buffer.append(indentation, "true || false,");
      break;
    case "byte":
      buffer.append(indentation, "0, // BYTE_VALUE");
      break;
    case "document":
      buffer.append(indentation, '"DOCUMENT_VALUE",');
      break;
    case "double":
      buffer.append(indentation, 'Number("double"),');
      break;
    case "float":
      buffer.append(indentation, 'Number("float"),');
      break;
    case "integer":
      buffer.append(indentation, 'Number("int"),');
      break;
    case "long":
      buffer.append(indentation, 'Number("long"),');
      break;
    case "short":
      buffer.append(indentation, 'Number("short"),');
      break;
    case "string":
      buffer.append(indentation, '"STRING_VALUE",');
      break;
    case "timestamp":
      buffer.append(indentation, 'new Date("TIMESTAMP"),');
      break;
    case "set":
    case "list": {
      buffer.append(
        indentation,
        "[" + (tracker.getOccurrenceCount(target) === 1 ? " // " + target.getId().getName() : "")
      );
      checkRequired(indentation, buffer, shape);
      shapeExample((target as ListShape).getMember(), buffer, model, indentation + 2, tracker, isInput);
      buffer.append(indentation, "],\n");
      break;
    }
    case "map": {
      buffer.append(
        indentation,
        "{" + (tracker.getOccurrenceCount(target) === 1 ? " // " + target.getId().getName() : "")
      );
      checkRequired(indentation, buffer, shape);
      buffer.append(indentation + 2, '"<keys>": ');
      const map = target as MapShape;
      shapeExample(model.getShape(map.getValue().getTarget())!, buffer, model, indentation + 2, tracker, isInput);
      buffer.append(indentation, "},\n");
      break;
    }
    case "structure":
      structure(target as StructureShape, buffer, model, indentation, tracker, isInput);
      break;
    case "union":
      union(target as UnionShape, buffer, model, indentation, tracker, isInput);
      break;
    case "enum": {
      const enumeration = [...(target as EnumShape).getEnumValues().values()].map((s) => `"${s}"`).join(" || ");
      buffer.append(indentation, enumeration + ",");
      break;
    }
    case "intEnum": {
      const intEnumeration = [...(target as IntEnumShape).getEnumValues().values()].map(String).join(" || ");
      buffer.append(indentation, intEnumeration + ",");
      break;
    }
    default:
      buffer.append(indentation, '"...",');
      break;
  }
  switch (target.getType()) {
    case "structure":
    case "union":
    case "list":
    case "set":
    case "map":
      break;
    default:
      checkRequired(indentation, buffer, shape);
      break;
  }
};
