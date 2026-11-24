import type { SymbolBuilder, SymbolProvider } from "../codegen-core";
import {
  CodegenException,
  ReservedWordEscaper,
  ReservedWordsBuilder,
  Symbol,
  SymbolReference,
  ContextOption,
} from "../codegen-core";
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
  ListShape,
  LongShape,
  MapShape,
  MemberShape,
  Model,
  OperationShape,
  ResourceShape,
  SetShape,
  Shape,
  ShapeId,
  ShortShape,
  StringShape,
  StructureShape,
  TimestampShape,
  ToShapeId,
  UnionShape,
} from "../model";
import {
  EnumTrait,
  ErrorTrait,
  MediaTypeTrait,
  OperationIndex,
  ServiceShape,
  ShapeVisitor,
  SparseTrait,
  StreamingTrait,
  UnitTypeTrait,
  TreeMap,
  TreeSet,
} from "../model";
import { CodegenUtils } from "./CodegenUtils";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { RESERVED_MEMBER_WORDS, RESERVED_WORDS } from "./TypeScriptReservedWords";
import { TypeScriptWriter } from "./TypeScriptWriter";

const ENUM_TRAIT_PROPERTY = "software.amazon.smithy.model.traits.EnumTrait";
export const IMPLEMENTS_INTERFACE_PROPERTY = "implementsInterface";

const SHAPE_NAMESPACE_PREFIX = "models";
const COMMANDS_FOLDER = "commands";
const DEFAULT_CHUNK_SIZE = 300;

/**
 * Maps Smithy shapes to TypeScript symbols.
 */
export class SymbolVisitor extends ShapeVisitor<Symbol> implements SymbolProvider {
  private readonly _model: Model;
  private readonly _settings: TypeScriptSettings;
  private readonly _renames: Map<string, string>;
  private readonly _escaper: ReservedWordEscaper;
  private readonly _errorShapes = new Set<Shape>();
  private readonly _moduleNameDelegator: ModuleNameDelegator;
  private readonly _createTypeOnlySymbols: boolean;

  public constructor(
    model: Model,
    settings: TypeScriptSettings,
    shapeChunkSize: number = DEFAULT_CHUNK_SIZE,
    renames: Map<string, string> = new Map()
  ) {
    super();
    this._model = model;
    this._settings = settings;
    this._renames = renames;
    this._createTypeOnlySymbols = settings.generateClient() || settings.isTypesOnly();

    const reservedWords = new ReservedWordsBuilder().addWords(RESERVED_WORDS).build();
    const memberReservedWords = new ReservedWordsBuilder().addWords(RESERVED_MEMBER_WORDS).build();
    this._escaper = new ReservedWordEscaper({
      nameReservedWords: reservedWords,
      memberReservedWords,
      escapePredicate: (_shape, symbol) => symbol.getDefinitionFile() !== "",
    });

    if (settings.getOptionalService() !== undefined) {
      const operationIndex = OperationIndex.of(model);
      for (const operation of model.getOperationShapes()) {
        for (const error of operationIndex.getErrors(operation, settings.getService())) {
          this._errorShapes.add(error);
        }
      }
    } else {
      for (const shape of model.getStructureShapes()) {
        if (shape.hasTrait(ErrorTrait)) {
          this._errorShapes.add(shape);
        }
      }
    }
    this._moduleNameDelegator = new ModuleNameDelegator(shapeChunkSize);
  }

  public static modelIndexer(shapes: Iterable<Shape>, symbolProvider: SymbolProvider): TypeScriptWriter {
    return ModuleNameDelegator.modelIndexer(shapes, symbolProvider);
  }

  public toSymbol(shape: Shape): Symbol {
    let typeOnly = this._createTypeOnlySymbols;
    const isError = shape.asStructureShape() !== undefined && shape.hasTrait(ErrorTrait);
    if (shape.isOperationShape() || shape.isResourceShape() || isError || shape.isServiceShape()) {
      typeOnly = false;
    }
    const symbol = shape.accept(this).toBuilder().putProperty("typeOnly", typeOnly).build();
    return this._escaper.escapeSymbol(shape, symbol);
  }

  public toMemberName(shape: MemberShape): string {
    return this._escaper.escapeMemberName(shape.getMemberName());
  }

  public blobShape(shape: BlobShape): Symbol {
    if (shape.hasTrait(StreamingTrait)) {
      return this._createSymbolBuilder(shape, "StreamingBlobTypes", null)
        .addReference(
          Symbol.builder()
            .addDependency(TypeScriptDependency.SMITHY_TYPES)
            .name("StreamingBlobTypes")
            .namespace("@smithy/types", "/")
            .putProperty("typeOnly", this._createTypeOnlySymbols)
            .build()
        )
        .build();
    }
    return this._createSymbolBuilder(shape, "Uint8Array").build();
  }

  public booleanShape(shape: BooleanShape): Symbol {
    return this._createSymbolBuilder(shape, "boolean").build();
  }

  public listShape(shape: ListShape): Symbol {
    const sparse = shape.hasTrait(SparseTrait);
    const reference = this.toSymbol(shape.getMember());
    const valueType = (sparse ? "(" : "") + reference.getName() + (sparse ? " | null)" : "");
    return this._createSymbolBuilder(shape, `${valueType}[]`, null)
      .addReference(reference)
      .putProperty("typeOnly", this._createTypeOnlySymbols)
      .build();
  }

  public setShape(shape: SetShape): Symbol {
    const reference = this.toSymbol(shape.getMember());
    return this._createSymbolBuilder(shape, `${reference.getName()}[]`, null)
      .addReference(reference)
      .putProperty("typeOnly", this._createTypeOnlySymbols)
      .build();
  }

  public mapShape(shape: MapShape): Symbol {
    const key = this.toSymbol(shape.getKey());
    const value = this.toSymbol(shape.getValue());
    const stringKey = key.toString() === "string";
    const sparse = shape.hasTrait(SparseTrait);
    const valueType = value.getName() + (sparse ? " | null" : "");
    const keyName = key.getName();
    return this._createSymbolBuilder(
      shape,
      stringKey ? `Record<${keyName}, ${valueType}>` : `Partial<Record<${keyName}, ${valueType}>>`,
      null
    )
      .addReference(key)
      .addReference(value)
      .putProperty("typeOnly", this._createTypeOnlySymbols)
      .build();
  }

  public byteShape(shape: ByteShape): Symbol {
    return this._createNumber(shape);
  }

  public shortShape(shape: ShortShape): Symbol {
    return this._createNumber(shape);
  }

  public integerShape(shape: IntegerShape): Symbol {
    return this._createNumber(shape);
  }

  public longShape(shape: LongShape): Symbol {
    return this._createNumber(shape);
  }

  public floatShape(shape: FloatShape): Symbol {
    return this._createNumber(shape);
  }

  public doubleShape(shape: DoubleShape): Symbol {
    return this._createNumber(shape);
  }

  public bigIntegerShape(shape: BigIntegerShape): Symbol {
    if (this._settings.getBigNumberMode() === "native") {
      return this._createSymbolBuilder(shape, "bigint").build();
    }
    return this._createBigJsSymbol(shape);
  }

  public bigDecimalShape(shape: BigDecimalShape): Symbol {
    if (this._settings.getBigNumberMode() === "native") {
      return this._createSymbolBuilder(shape, "NumericValue", null)
        .addReference(
          Symbol.builder()
            .addDependency(TypeScriptDependency.SMITHY_CORE)
            .name("NumericValue")
            .putProperty("typeOnly", this._createTypeOnlySymbols)
            .namespace("@smithy/core/serde", "/")
            .build()
        )
        .build();
    }
    return this._createBigJsSymbol(shape);
  }

  public documentShape(shape: DocumentShape): Symbol {
    const builder = this._createSymbolBuilder(shape, "__DocumentType");
    const importSymbol = Symbol.builder()
      .name("DocumentType")
      .namespace(TypeScriptDependency.SMITHY_TYPES.packageName, "/")
      .putProperty("typeOnly", this._createTypeOnlySymbols)
      .build();
    const reference = SymbolReference.builder()
      .symbol(importSymbol)
      .alias("__DocumentType")
      .options(ContextOption.USE)
      .putProperty("typeOnly", this._createTypeOnlySymbols)
      .build();
    return builder.addReference(reference).build();
  }

  public operationShape(shape: OperationShape): Symbol {
    const commandName = this._flattenShapeName(shape) + "Command";
    const moduleName = this._moduleNameDelegator.formatModuleName(shape, commandName);
    const intermediate = this._createGeneratedSymbolBuilder(shape, commandName, moduleName).build();
    const builder = intermediate.toBuilder().putProperty("typeOnly", false);
    builder.putProperty(
      "inputType",
      intermediate
        .toBuilder()
        .putProperty("typeOnly", this._createTypeOnlySymbols)
        .name(commandName + "Input")
        .build()
    );
    builder.putProperty(
      "outputType",
      intermediate
        .toBuilder()
        .putProperty("typeOnly", this._createTypeOnlySymbols)
        .name(commandName + "Output")
        .build()
    );
    return builder.build();
  }

  public stringShape(shape: StringShape): Symbol {
    const enumTrait = shape.getTrait(EnumTrait);
    if (enumTrait !== undefined) {
      return this._createEnumSymbol(shape, enumTrait);
    }
    const mediaTypeTrait = shape.getTrait(MediaTypeTrait);
    if (mediaTypeTrait !== undefined) {
      const mediaType = mediaTypeTrait.getValue();
      if (CodegenUtils.isJsonMediaType(mediaType)) {
        const builder = this._createSymbolBuilder(shape, "__AutomaticJsonStringConversion | string");
        return this._addSmithyUseImport(
          builder,
          "AutomaticJsonStringConversion",
          "__AutomaticJsonStringConversion"
        ).build();
      }
      console.warn(`Found unsupported mediatype ${mediaType} on String shape: ${shape}`);
    }
    return this._createSymbolBuilder(shape, "string").build();
  }

  public enumShape(shape: EnumShape): Symbol {
    return this.stringShape(shape).toBuilder().putProperty("typeOnly", true).build();
  }

  public intEnumShape(shape: IntEnumShape): Symbol {
    return this._createObjectSymbolBuilder(shape).putProperty("typeOnly", true).build();
  }

  public resourceShape(shape: ResourceShape): Symbol {
    return this._createObjectSymbolBuilder(shape).build();
  }

  public serviceShape(shape: ServiceShape): Symbol {
    const name = StringUtilsCapitalize(shape.getId().getName()) + "Client";
    const moduleName = this._moduleNameDelegator.formatModuleName(shape, name);
    return this._createGeneratedSymbolBuilder(shape, name, moduleName).putProperty("typeOnly", false).build();
  }

  public structureShape(shape: StructureShape): Symbol {
    return this._createObjectSymbolBuilder(shape).build();
  }

  public unionShape(shape: UnionShape): Symbol {
    return this._createObjectSymbolBuilder(shape).build();
  }

  public memberShape(shape: MemberShape): Symbol {
    const targetShape = this._model.getShape(shape.getTarget());
    if (targetShape === undefined) {
      throw new CodegenException("Shape not found: " + shape.getTarget());
    }
    const targetSymbol = this.toSymbol(targetShape);
    if (targetSymbol.getProperties().has(ENUM_TRAIT_PROPERTY) || targetShape.isIntEnumShape()) {
      return this._createMemberSymbolWithEnumTarget(targetSymbol);
    }
    if (targetShape.hasTrait(StreamingTrait) && targetShape.isUnionShape()) {
      return this._createMemberSymbolWithEventStream(targetSymbol);
    }
    return targetSymbol;
  }

  public timestampShape(shape: TimestampShape): Symbol {
    return this._createSymbolBuilder(shape, "Date").build();
  }

  private _createNumber(shape: Shape): Symbol {
    return this._createSymbolBuilder(shape, "number").build();
  }

  private _createBigJsSymbol(shape: Shape): Symbol {
    return this._createSymbolBuilder(shape, "Big", TypeScriptDependency.BIG_JS.packageName)
      .addDependency(TypeScriptDependency.TYPES_BIG_JS)
      .addDependency(TypeScriptDependency.BIG_JS)
      .build();
  }

  private _createEnumSymbol(shape: StringShape, enumTrait: EnumTrait): Symbol {
    return this._createObjectSymbolBuilder(shape)
      .putProperty(ENUM_TRAIT_PROPERTY, enumTrait)
      .putProperty("typeOnly", true)
      .build();
  }

  private _addSmithyUseImport(builder: SymbolBuilder, name: string, as: string): SymbolBuilder {
    const importSymbol = Symbol.builder().name(name).namespace("@smithy/core/serde", "/").build();
    const reference = SymbolReference.builder().symbol(importSymbol).alias(as).options(ContextOption.USE).build();
    return builder.addReference(reference);
  }

  private _createMemberSymbolWithEnumTarget(targetSymbol: Symbol): Symbol {
    return targetSymbol
      .toBuilder()
      .namespace(null, "/")
      .name(targetSymbol.getName())
      .addReference(targetSymbol)
      .build();
  }

  private _createMemberSymbolWithEventStream(targetSymbol: Symbol): Symbol {
    return targetSymbol
      .toBuilder()
      .putProperty("typeOnly", this._createTypeOnlySymbols)
      .namespace(null, "/")
      .name(`AsyncIterable<${targetSymbol.getName()}>`)
      .addReference(targetSymbol)
      .build();
  }

  private _flattenShapeName(id: ToShapeId): string {
    const shapeId = id.toShapeId();
    if (this._renames.size > 0 || this._settings.getOptionalService() === undefined) {
      const renamed = this._renames.get(shapeId.toString());
      return StringUtilsCapitalize(renamed ?? shapeId.getName());
    }
    const serviceShape = this._model.expectShape(this._settings.getService(), ServiceShape) as ServiceShape;
    return StringUtilsCapitalize(serviceShape.getContextualName(shapeId));
  }

  private _createObjectSymbolBuilder(shape: Shape): SymbolBuilder {
    const name = this._flattenShapeName(shape);
    const moduleName = this._moduleNameDelegator.formatModuleName(shape, name);
    return this._createGeneratedSymbolBuilder(shape, name, moduleName);
  }

  private _createSymbolBuilder(shape: Shape, typeName: string, namespace?: string | null): SymbolBuilder {
    const builder = Symbol.builder().putProperty("shape", shape).name(typeName);
    return namespace === undefined ? builder : builder.namespace(namespace, "/");
  }

  private _createGeneratedSymbolBuilder(shape: Shape, typeName: string, namespace: string): SymbolBuilder {
    const trimmedNamespace = namespace.startsWith("./") ? namespace.substring(2) : namespace;
    const prefixedNamespace = [".", CodegenUtils.SOURCE_FOLDER, trimmedNamespace].join("/");
    return this._createSymbolBuilder(shape, typeName, prefixedNamespace).definitionFile(prefixedNamespace + ".ts");
  }
}

const StringUtilsCapitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

class ModuleNameDelegator {
  private readonly _visitedModels = new Map<Shape, string>();
  private _bucketCount = 0;
  private _currentBucketSize = 0;
  private readonly _chunkSize: number;

  public constructor(shapeChunkSize: number) {
    this._chunkSize = shapeChunkSize;
  }

  public static modelIndexer(shapes: Iterable<Shape>, symbolProvider: SymbolProvider): TypeScriptWriter {
    const shapeList = [...shapes];
    const writer = new TypeScriptWriter("");
    const modelPrefix = [".", CodegenUtils.SOURCE_FOLDER, SHAPE_NAMESPACE_PREFIX].join("/");
    const collected = [
      ...new TreeSet(
        shapeList
          .map((shape) => symbolProvider.toSymbol(shape).getNamespace())
          .filter((ns) => ns.startsWith(modelPrefix))
      ),
    ].map((ns) => ns.replace(modelPrefix, [".", SHAPE_NAMESPACE_PREFIX].join("/")));

    if (collected.length === 0) {
      writer.write("export {};");
    } else {
      for (const namespace of collected) {
        const typesOnly = namespace.includes("models_");
        if (!typesOnly) {
          writer.write("export * from $S;", namespace);
        }
      }
    }

    const namespaceToShapes = new TreeMap<string, TreeSet<string>>();
    const sourcePrefix = [".", CodegenUtils.SOURCE_FOLDER].join("/");
    for (const shape of shapeList) {
      if (shape.isStructureShape() && !shape.hasTrait(ErrorTrait)) {
        const symbol = symbolProvider.toSymbol(shape);
        const namespace = symbol.getNamespace().replace(sourcePrefix, ".");
        const names = namespaceToShapes.get(namespace) ?? new TreeSet<string>();
        names.add(symbol.getName());
        namespaceToShapes.set(namespace, names);
      }
    }
    for (const namespace of namespaceToShapes.keys()) {
      writer.write("export * from $S;", namespace);
    }
    return writer;
  }

  public formatModuleName(shape: Shape, name: string): string {
    if (shape.getType() === "service") {
      return [".", name].join("/");
    }
    if (shape.getType() === "operation") {
      return [".", COMMANDS_FOLDER, name].join("/");
    }
    const visited = this._visitedModels.get(shape);
    if (visited !== undefined) {
      return visited;
    }
    let path: string;
    if (shape.isEnumShape() || shape.isIntEnumShape() || shape.hasTrait(EnumTrait)) {
      path = [".", SHAPE_NAMESPACE_PREFIX, "enums"].join("/");
    } else if (shape.isStructureShape() && shape.hasTrait(ErrorTrait)) {
      path = [".", SHAPE_NAMESPACE_PREFIX, "errors"].join("/");
    } else if (shape.getId().equals(UnitTypeTrait.UNIT) || shape.isResourceShape()) {
      path = [".", SHAPE_NAMESPACE_PREFIX, "models_0"].join("/");
    } else {
      path = [".", SHAPE_NAMESPACE_PREFIX, "models_" + this._bucketCount].join("/");
      this._currentBucketSize++;
      if (this._currentBucketSize === this._chunkSize) {
        this._bucketCount++;
        this._currentBucketSize = 0;
      }
    }
    this._visitedModels.set(shape, path);
    return path;
  }
}

export type { ShapeId };
