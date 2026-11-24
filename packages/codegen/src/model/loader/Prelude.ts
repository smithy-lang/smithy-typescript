import { ShapeId } from "../shapes/ShapeId";
import type { ToShapeId } from "../shapes/ShapeId";
import { StructureShape } from "../shapes/AggregateShapes";
import {
  BigDecimalShape,
  BigIntegerShape,
  BlobShape,
  BooleanShape,
  ByteShape,
  DocumentShape,
  DoubleShape,
  FloatShape,
  IntegerShape,
  LongShape,
  ShortShape,
  StringShape,
  TimestampShape,
} from "../shapes/SimpleShapes";
import type { Shape, ShapeInit } from "../shapes/Shape";
import { AuthDefinitionTrait } from "../traits/AuthTraits";
import { BoxTrait } from "../traits/AnnotationTraits";
import { DefaultTrait } from "../traits/DefaultTrait";
import { UnitTypeTrait } from "../traits/UnitTypeTrait";
import type { Trait } from "../traits/Trait";

const NAMESPACE = "smithy.api";
let preludeShapes: Shape[] | undefined;

/**
 * The shapes of the Smithy prelude that are not trait definitions: simple shapes, `Unit`, and the auth schemes.
 *
 * @internal
 */
export class Prelude {
  public static isPreludeShape(id: ToShapeId): boolean {
    return id.toShapeId().getNamespace() === NAMESPACE;
  }

  /**
   * Returns the shapes that a loaded model always contains.
   */
  public static getPreludeShapes(): readonly Shape[] {
    if (preludeShapes === undefined) {
      preludeShapes = createPreludeShapes();
    }
    return preludeShapes;
  }
}

function createPreludeShapes(): Shape[] {
  const shapes: Shape[] = [];
  const id = (name: string): ShapeId => ShapeId.fromParts(NAMESPACE, name);
  const init = (name: string, ...traits: Trait[]): ShapeInit => ({ id: id(name), traits });
  shapes.push(new StringShape(init("String")));
  shapes.push(new BlobShape(init("Blob")));
  shapes.push(new BigIntegerShape(init("BigInteger")));
  shapes.push(new BigDecimalShape(init("BigDecimal")));
  shapes.push(new TimestampShape(init("Timestamp")));
  shapes.push(new DocumentShape(init("Document")));
  shapes.push(new BooleanShape(init("Boolean", new BoxTrait())));
  shapes.push(new ByteShape(init("Byte", new BoxTrait())));
  shapes.push(new ShortShape(init("Short", new BoxTrait())));
  shapes.push(new IntegerShape(init("Integer", new BoxTrait())));
  shapes.push(new LongShape(init("Long", new BoxTrait())));
  shapes.push(new FloatShape(init("Float", new BoxTrait())));
  shapes.push(new DoubleShape(init("Double", new BoxTrait())));
  shapes.push(new BooleanShape(init("PrimitiveBoolean", new DefaultTrait(false))));
  shapes.push(new ByteShape(init("PrimitiveByte", new DefaultTrait(0))));
  shapes.push(new ShortShape(init("PrimitiveShort", new DefaultTrait(0))));
  shapes.push(new IntegerShape(init("PrimitiveInteger", new DefaultTrait(0))));
  shapes.push(new LongShape(init("PrimitiveLong", new DefaultTrait(0))));
  shapes.push(new FloatShape(init("PrimitiveFloat", new DefaultTrait(0))));
  shapes.push(new DoubleShape(init("PrimitiveDouble", new DefaultTrait(0))));
  shapes.push(new StructureShape(init("Unit", new UnitTypeTrait())));
  for (const name of ["httpBasicAuth", "httpDigestAuth", "httpBearerAuth", "httpApiKeyAuth"]) {
    shapes.push(new StructureShape(init(name, new AuthDefinitionTrait())));
  }
  return shapes;
}
