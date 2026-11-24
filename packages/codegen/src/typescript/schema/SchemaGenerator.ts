import { CodegenException, type FileManifest, type SymbolProvider } from "../../codegen-core";
import {
  ErrorTrait,
  type MapShape,
  type MemberShape,
  type Model,
  type OperationShape,
  type ServiceShape,
  type Shape,
  ShapeId,
  type StructureShape,
  StreamingTrait,
  TimestampFormatTrait,
  type UnionShape,
  TreeSet,
} from "../../model";
import { CodegenUtils } from "../CodegenUtils";
import { ServiceClosure } from "../knowledge/ServiceClosure";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import { TypeScriptWriter } from "../TypeScriptWriter";
import { StringStore } from "../util";
import { SchemaGenerationAllowlist } from "./SchemaGenerationAllowlist";
import { SchemaReferenceIndex } from "./SchemaReferenceIndex";
import { SchemaTraitWriter } from "./SchemaTraitWriter";

const SCHEMAS_FOLDER = "schemas";

const UNIT = ShapeId.from("smithy.api#Unit");

type CollectionShape = Shape;

/**
 * Generates the static schemas used for schema-based serde.
 */
export class SchemaGenerator {
  private readonly _elision: SchemaReferenceIndex;
  private readonly _settings: TypeScriptSettings;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _model: Model;
  private readonly _fileManifest: FileManifest;
  private readonly _store = new StringStore();
  private readonly _writer = new TypeScriptWriter("");
  private readonly _closure: ServiceClosure;
  private readonly _errorRegistries = new TreeSet<string>();

  public constructor(
    model: Model,
    fileManifest: FileManifest,
    settings: TypeScriptSettings,
    symbolProvider: SymbolProvider,
    shapes?: Shape[]
  ) {
    this._model = model;
    this._fileManifest = fileManifest;
    if (shapes === undefined) {
      if (settings.getOptionalService() === undefined) {
        throw new CodegenException(
          "SchemaGenerator requires a service; use the constructor taking a shape collection instead."
        );
      }
      this._closure = ServiceClosure.of(model, settings.getService(model));
    } else {
      this._closure = ServiceClosure.ofShapes(model, shapes);
    }
    this._elision = SchemaReferenceIndex.of(model);
    this._settings = settings;
    this._symbolProvider = symbolProvider;
    this._writer.write("/* eslint no-var: 0 */");
  }

  public run(): void {
    if (!this._settings.isTypesOnly()) {
      for (const service of this._model.getServiceShapes() as readonly ServiceShape[]) {
        if (!SchemaGenerationAllowlist.allows(service.getId(), this._settings)) {
          return;
        }
      }
      this._writeBaseError();
    }
    this._writeErrors();
    this._closure.getSimpleShapes().forEach((shape) => this._writeSimpleSchema(shape));
    this._closure.getStructureShapes().forEach((shape) => this._writeStructureSchema(shape as StructureShape));
    this._closure.getCollectionShapes().forEach((shape) => this._writeListSchema(shape));
    this._closure.getMapShapes().forEach((shape) => this._writeMapSchema(shape as MapShape));
    this._closure.getUnionShapes().forEach((shape) => this._writeUnionSchema(shape as UnionShape));
    this._closure.getOperationShapes().forEach((shape) => this._writeOperationSchema(shape));

    const stringConstants = this._store.flushVariableDeclarationCode();
    const hasContent = !/^\/\* eslint no-var: 0 \*\/[\s\n]+$/.test(this._writer.toString());
    if (hasContent) {
      this._fileManifest.writeFile(
        [CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER, "schemas_0.ts"].join("/"),
        stringConstants + "\n" + this._writer
      );
    }
  }

  private _getShapeVariableName(shape: Shape): string {
    return this._closure.getShapeSchemaVariableName(shape, this._store);
  }

  private _writeSimpleSchema(shape: Shape): void {
    const writer = this._writer;
    if (this._elision.traits.hasSchemaTraits(shape)) {
      writer.addTypeImport("StaticSimpleSchema", null, TypeScriptDependency.SMITHY_TYPES);
      writer.writeInline(
        "var $L: StaticSimpleSchema = [0, $L, $L, ",
        this._getShapeVariableName(shape),
        this._store.var(shape.getId().getNamespace(), "n"),
        this._store.var(shape.getId().getName())
      );
      this._writeTraits(shape);
      writer.writeInline(", $L];", this._resolveSimpleSchema(shape, shape));
      writer.ensureNewline();
    }
  }

  private _writeStructureSchema(shape: StructureShape): void {
    this._checkedWriteSchema(shape, () => {
      if (!shape.hasTrait(ErrorTrait)) {
        this._writer.addTypeImport("StaticStructureSchema", null, TypeScriptDependency.SMITHY_TYPES);
        this._writer.openBlock(
          "export var $L: StaticStructureSchema = [3, $L, $L,",
          "];",
          this._getShapeVariableName(shape),
          this._store.var(shape.getId().getNamespace(), "n"),
          this._store.var(shape.getId().getName()),
          () => this._doWithMembers(shape)
        );
      }
    });
  }

  private _writeErrors(): void {
    const writer = this._writer;
    for (const shape of this._closure.getErrorShapes()) {
      const ns = this._store.var(shape.getId().getNamespace(), "n");
      const errorRegistryVarName = ns + "_registry";
      if (!this._errorRegistries.has(errorRegistryVarName)) {
        writer.addImportSubmodule("TypeRegistry", null, TypeScriptDependency.SMITHY_CORE, "/schema");
        writer.write("const $L = new TypeRegistry($L);", errorRegistryVarName, ns);
        this._errorRegistries.add(errorRegistryVarName);
      }
    }
    for (const shape of this._closure.getErrorShapes()) {
      const errorShape = shape.asStructureShape();
      if (errorShape !== undefined) {
        const ns = this._store.var(shape.getId().getNamespace(), "n");
        const errorRegistryVarName = ns + "_registry";
        const exceptionCtorSymbolName = this._symbolProvider.toSymbol(shape).getName();
        writer.addTypeImport("StaticErrorSchema", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport(exceptionCtorSymbolName, null, "../models/errors");
        writer.openBlock(
          "export var $L: StaticErrorSchema = [-3, $L, $L,",
          "];",
          this._getShapeVariableName(shape),
          this._store.var(shape.getId().getNamespace(), "n"),
          this._store.var(shape.getId().getName()),
          () => this._doWithMembers(shape)
        );
        errorShape.expectTrait(ErrorTrait);
        writer.write(
          "$L.registerError($L, $L);",
          errorRegistryVarName,
          this._getShapeVariableName(shape),
          exceptionCtorSymbolName
        );
      }
    }
    writer.writeDocs("TypeRegistry instances containing modeled errors.\n@internal\n");
    writer.openBlock("export const errorTypeRegistries = [", "]", () => {
      for (const errorRegistry of this._errorRegistries) {
        writer.write("$L,", errorRegistry);
      }
    });
  }

  private _writeBaseError(): void {
    const writer = this._writer;
    const serviceName = CodegenUtils.getServiceName(this._settings, this._model, this._symbolProvider);
    const syntheticBaseExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, this._model);
    const schemaSymbolName = syntheticBaseExceptionName + "$";
    const namespace = this._settings.getService(this._model).getId().getNamespace();
    writer.addTypeImport("StaticErrorSchema", null, TypeScriptDependency.SMITHY_TYPES);
    writer.addRelativeImport(syntheticBaseExceptionName, null, "../models/" + syntheticBaseExceptionName);
    const syntheticNamespace = this._store.var("smithy.ts.sdk.synthetic." + namespace);
    const syntheticNamespaceTypeRegistry = syntheticNamespace + "_registry";
    writer.addImportSubmodule("TypeRegistry", null, TypeScriptDependency.SMITHY_CORE, "/schema");
    writer.write("const $L = new TypeRegistry($L);", syntheticNamespaceTypeRegistry, syntheticNamespace);
    this._errorRegistries.add(syntheticNamespaceTypeRegistry);
    writer.write(
      "export var $L: StaticErrorSchema = [-3, $L, $S, 0, [], []];",
      schemaSymbolName,
      syntheticNamespace,
      syntheticBaseExceptionName
    );
    writer.write(
      "$L.registerError($L, $L);",
      syntheticNamespaceTypeRegistry,
      schemaSymbolName,
      syntheticBaseExceptionName
    );
  }

  private _writeUnionSchema(shape: UnionShape): void {
    this._checkedWriteSchema(shape, () => {
      this._writer.addTypeImport("StaticUnionSchema", null, TypeScriptDependency.SMITHY_TYPES);
      this._writer.openBlock(
        "export var $L: StaticUnionSchema = [4, $L, $L,",
        "];",
        this._getShapeVariableName(shape),
        this._store.var(shape.getId().getNamespace(), "n"),
        this._store.var(shape.getId().getName()),
        () => this._doWithMembers(shape)
      );
    });
  }

  private _doWithMembers(shape: Shape): void {
    const writer = this._writer;
    this._writeTraits(shape);
    let requiredMemberCount = 0;
    const orderedNames: string[] = [];
    const orderedMembers: MemberShape[] = [];
    for (const member of shape.getAllMembers().values()) {
      if (ServiceClosure.isMemberRequiredInClient(member)) {
        requiredMemberCount += 1;
        orderedNames.push(member.getMemberName());
        orderedMembers.push(member);
      }
    }
    for (const member of shape.getAllMembers().values()) {
      if (!ServiceClosure.isMemberRequiredInClient(member)) {
        orderedNames.push(member.getMemberName());
        orderedMembers.push(member);
      }
    }
    writer.write(",");
    writer.writeInline("[");
    orderedNames.forEach((memberName) => {
      writer.writeInline("$L, ", this._store.var(memberName));
    });
    writer.unwrite(", ");
    writer.write("],");
    writer.writeInline("[");
    orderedMembers.forEach((member) => {
      const ref = this._resolveSchema(shape, member);
      if (this._elision.traits.hasSchemaTraits(member)) {
        writer.writeInline("[$L, ", ref);
        this._writeTraits(member);
        writer.writeInline("], ");
      } else {
        writer.writeInline("$L, ", ref);
      }
    });
    writer.unwrite(", ");
    if (requiredMemberCount > 0 && shape.isStructureShape()) {
      writer.write("], $L", String(requiredMemberCount));
    } else {
      writer.write("]");
    }
  }

  private _writeListSchema(shape: CollectionShape): void {
    this._checkedWriteSchema(shape, () => {
      this._writer.addTypeImport("StaticListSchema", null, TypeScriptDependency.SMITHY_TYPES);
      this._writer.openBlock(
        "var $L: StaticListSchema = [1, $L, $L,",
        "];",
        this._getShapeVariableName(shape),
        this._store.var(shape.getId().getNamespace(), "n"),
        this._store.var(shape.getId().getName()),
        () => this._doWithMember(shape, (shape.asListShape() ?? shape.asSetShape())!.getMember())
      );
    });
  }

  private _writeMapSchema(shape: MapShape): void {
    this._checkedWriteSchema(shape, () => {
      this._writer.addTypeImport("StaticMapSchema", null, TypeScriptDependency.SMITHY_TYPES);
      this._writer.openBlock(
        "var $L: StaticMapSchema = [2, $L, $L,",
        "];",
        this._getShapeVariableName(shape),
        this._store.var(shape.getId().getNamespace(), "n"),
        this._store.var(shape.getId().getName()),
        () => this._doWithMapMembers(shape, shape.getKey(), shape.getValue())
      );
    });
  }

  private _doWithMember(shape: Shape, memberShape: MemberShape): void {
    const writer = this._writer;
    this._writeTraits(shape);
    const ref = this._resolveSchema(shape, memberShape);
    if (this._elision.traits.hasSchemaTraits(memberShape)) {
      writer.openBlock(", [$L, ", "]", ref, () => {
        this._writeTraits(memberShape);
      });
    } else {
      writer.write(", $L", ref);
    }
  }

  private _doWithMapMembers(shape: Shape, keyShape: MemberShape, memberShape: MemberShape): void {
    const writer = this._writer;
    this._writeTraits(shape);
    const keyRef = this._resolveSchema(shape, keyShape);
    const valueRef = this._resolveSchema(shape, memberShape);
    if (this._elision.traits.hasSchemaTraits(memberShape) || this._elision.traits.hasSchemaTraits(keyShape)) {
      writer.openBlock(", [$L, ", "]", keyRef, () => {
        this._writeTraits(keyShape);
      });
      writer.openBlock(", [$L, ", "]", valueRef, () => {
        this._writeTraits(memberShape);
      });
    } else {
      writer.write(", $L, $L", keyRef, valueRef);
    }
  }

  private _writeOperationSchema(shape: OperationShape): void {
    const writer = this._writer;
    writer.addTypeImport("StaticOperationSchema", null, TypeScriptDependency.SMITHY_TYPES);
    writer.openBlock(
      "export var $L: StaticOperationSchema = [9, $L, $L,",
      "];",
      this._getShapeVariableName(shape),
      this._store.var(shape.getId().getNamespace(), "n"),
      this._store.var(shape.getId().getName()),
      () => {
        this._writeTraits(shape);
        writer.write(
          ", () => $L, () => $L",
          this._getShapeVariableName(this._model.expectShape(shape.getInputShape())),
          this._getShapeVariableName(this._model.expectShape(shape.getOutputShape()))
        );
      }
    );
  }

  private _writeTraits(shape: Shape): void {
    const traitCode = new SchemaTraitWriter(shape, this._elision, this._store).toString();
    this._writer.writeInline(traitCode.replace(/\$/g, "$$$$"));
  }

  private _checkedWriteSchema(shape: Shape, schemaWriteFn: () => void): void {
    const writer = this._writer;
    if (shape.getId().getNamespace() === "smithy.api" && shape.getId().getName() === "Unit") {
      writer.write('var __Unit = "unit" as const;');
    } else if (!this._elision.isReferenceSchema(shape) && !this._elision.traits.hasSchemaTraits(shape)) {
      const sentinel = this._resolveSchema(this._model.expectShape(UNIT), shape);
      const exportable = shape.isStructureShape() || shape.isUnionShape() || shape.isOperationShape();
      writer.write(exportable ? "export var $L = $L;" : "var $L = $L;", this._getShapeVariableName(shape), sentinel);
    } else {
      schemaWriteFn();
    }
  }

  private _resolveSchema(context: Shape, input: Shape): string {
    let shape = input;
    let memberShape: MemberShape | undefined;
    const asMember = shape.asMemberShape();
    if (asMember !== undefined) {
      memberShape = asMember;
      shape = this._model.expectShape(memberShape.getTarget());
    }
    const isReference = this._elision.isReferenceSchema(shape);
    const hasTraits = this._elision.traits.hasSchemaTraits(shape);
    if (!hasTraits) {
      try {
        return this._resolveSimpleSchema(context, memberShape ?? shape);
      } catch (e) {
        if (!(e instanceof NotSimpleError)) {
          throw e;
        }
      }
    }
    return (isReference || hasTraits ? "() => " : "") + this._getShapeVariableName(shape);
  }

  private _resolveSimpleSchema(context: Shape, input: Shape): string {
    let shape = input;
    let memberShape: MemberShape | undefined;
    const asMember = shape.asMemberShape();
    if (asMember !== undefined) {
      memberShape = asMember;
      shape = this._model.expectShape(memberShape.getTarget());
    }
    switch (shape.getType()) {
      case "boolean":
        return "2";
      case "string":
      case "enum":
        return "0";
      case "timestamp": {
        let trait = shape.getTrait(TimestampFormatTrait);
        if (memberShape !== undefined && memberShape.hasTrait(TimestampFormatTrait)) {
          trait = memberShape.getTrait(TimestampFormatTrait);
        }
        if (trait === undefined) {
          return "4";
        }
        switch (trait.getValue()) {
          case "date-time":
            return "5";
          case "http-date":
            return "6";
          case "epoch-seconds":
            return "7";
          default:
            return "4";
        }
      }
      case "blob":
        return shape.hasTrait(StreamingTrait) ? "42" : "21";
      case "byte":
      case "short":
      case "integer":
      case "intEnum":
      case "long":
      case "float":
      case "double":
        return "1";
      case "document":
        return "15";
      case "bigInteger":
        return "17";
      case "bigDecimal":
        return "19";
      case "list":
      case "set":
      case "map":
        return this._resolveSimpleSchemaNestedContainer(context, shape);
      default:
        throw new NotSimpleError("shape is not simple");
    }
  }

  private _resolveSimpleSchemaNestedContainer(context: Shape, shape: Shape): string {
    let contained: Shape;
    let staticTypePrefix: string;
    let sentinel: string;
    let keySchema = "";
    switch (shape.getType()) {
      case "list":
        contained = shape.asListShape()!.getMember();
        staticTypePrefix = "[1, ";
        sentinel = "64";
        this._writer.addTypeImport("StaticListSchema", null, TypeScriptDependency.SMITHY_TYPES);
        break;
      case "map":
        contained = shape.asMapShape()!.getValue();
        staticTypePrefix = "[2, ";
        keySchema = this._resolveSimpleSchema(context, shape.asMapShape()!.getKey()) + ", ";
        sentinel = "128";
        this._writer.addTypeImport("StaticMapSchema", null, TypeScriptDependency.SMITHY_TYPES);
        break;
      default:
        throw new NotSimpleError("call to resolveSimpleSchemaNestedContainer with incompatible shape type.");
    }
    const asMember = contained.asMemberShape();
    if (asMember !== undefined) {
      contained = this._model.expectShape(asMember.getTarget());
    }
    if (contained.isListShape() || contained.isMapShape()) {
      const schemaVarName = this._store.var(shape.getId().getName());
      return (
        staticTypePrefix +
        this._store.var(shape.getId().getNamespace(), "n") +
        ", " +
        schemaVarName +
        ", 0, " +
        keySchema +
        this._resolveSimpleSchema(context, contained) +
        "]"
      );
    }
    return sentinel + " | " + this._resolveSimpleSchema(context, contained);
  }
}

class NotSimpleError extends Error {}
