import type { MemberShape } from "./MemberShape";
import type { Shape } from "./Shape";
import type {
  BigDecimalShape,
  BigIntegerShape,
  BlobShape,
  BooleanShape,
  ByteShape,
  DocumentShape,
  DoubleShape,
  EnumShape,
  FloatShape,
  IntEnumShape,
  IntegerShape,
  LongShape,
  ShortShape,
  StringShape,
  TimestampShape,
} from "./SimpleShapes";
import type { ListShape, MapShape, SetShape, StructureShape, UnionShape } from "./AggregateShapes";
import type { OperationShape, ResourceShape, ServiceShape } from "./ServiceShapes";

/**
 * Visitor over all shape types. Extend this class to inherit the delegating defaults.
 *
 * @internal
 */
export abstract class ShapeVisitor<R> {
  public abstract blobShape(shape: BlobShape): R;

  public abstract booleanShape(shape: BooleanShape): R;

  public abstract listShape(shape: ListShape): R;

  public setShape(shape: SetShape): R {
    return this.listShape(shape as unknown as ListShape);
  }

  public abstract mapShape(shape: MapShape): R;

  public abstract byteShape(shape: ByteShape): R;

  public abstract shortShape(shape: ShortShape): R;

  public abstract integerShape(shape: IntegerShape): R;

  public intEnumShape(shape: IntEnumShape): R {
    return this.integerShape(shape);
  }

  public abstract longShape(shape: LongShape): R;

  public abstract floatShape(shape: FloatShape): R;

  public abstract documentShape(shape: DocumentShape): R;

  public abstract doubleShape(shape: DoubleShape): R;

  public abstract bigIntegerShape(shape: BigIntegerShape): R;

  public abstract bigDecimalShape(shape: BigDecimalShape): R;

  public abstract operationShape(shape: OperationShape): R;

  public abstract resourceShape(shape: ResourceShape): R;

  public abstract serviceShape(shape: ServiceShape): R;

  public abstract stringShape(shape: StringShape): R;

  public enumShape(shape: EnumShape): R {
    return this.stringShape(shape);
  }

  public abstract structureShape(shape: StructureShape): R;

  public abstract unionShape(shape: UnionShape): R;

  public abstract memberShape(shape: MemberShape): R;

  public abstract timestampShape(shape: TimestampShape): R;
}

/**
 * A visitor that routes shape types it does not override to {@link getDefault}.
 *
 * @internal
 */
export abstract class ShapeVisitorDefault<R> extends ShapeVisitor<R> {
  public blobShape(shape: BlobShape): R {
    return this.getDefault(shape);
  }

  public booleanShape(shape: BooleanShape): R {
    return this.getDefault(shape);
  }

  public listShape(shape: ListShape): R {
    return this.getDefault(shape);
  }

  public byteShape(shape: ByteShape): R {
    return this.getDefault(shape);
  }

  public shortShape(shape: ShortShape): R {
    return this.getDefault(shape);
  }

  public integerShape(shape: IntegerShape): R {
    return this.getDefault(shape);
  }

  public longShape(shape: LongShape): R {
    return this.getDefault(shape);
  }

  public floatShape(shape: FloatShape): R {
    return this.getDefault(shape);
  }

  public documentShape(shape: DocumentShape): R {
    return this.getDefault(shape);
  }

  public doubleShape(shape: DoubleShape): R {
    return this.getDefault(shape);
  }

  public bigIntegerShape(shape: BigIntegerShape): R {
    return this.getDefault(shape);
  }

  public bigDecimalShape(shape: BigDecimalShape): R {
    return this.getDefault(shape);
  }

  public mapShape(shape: MapShape): R {
    return this.getDefault(shape);
  }

  public operationShape(shape: OperationShape): R {
    return this.getDefault(shape);
  }

  public resourceShape(shape: ResourceShape): R {
    return this.getDefault(shape);
  }

  public serviceShape(shape: ServiceShape): R {
    return this.getDefault(shape);
  }

  public stringShape(shape: StringShape): R {
    return this.getDefault(shape);
  }

  public structureShape(shape: StructureShape): R {
    return this.getDefault(shape);
  }

  public unionShape(shape: UnionShape): R {
    return this.getDefault(shape);
  }

  public memberShape(shape: MemberShape): R {
    return this.getDefault(shape);
  }

  public timestampShape(shape: TimestampShape): R {
    return this.getDefault(shape);
  }
  protected abstract getDefault(shape: Shape): R;
}
