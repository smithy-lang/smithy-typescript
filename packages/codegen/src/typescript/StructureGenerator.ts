import type { SymbolProvider } from "../codegen-core";
import type { Model, StructureShape } from "../model";
import { ErrorTrait, RetryableTrait } from "../model";
import { documentedShape } from "./documentation/ShapeDocs";
import { IMPLEMENTS_INTERFACE_PROPERTY } from "./SymbolVisitor";
import { StructuredMemberWriter } from "./StructuredMemberWriter";
import type { RequiredMemberMode } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { SensitiveDataFinder } from "./validation/SensitiveDataFinder";

/**
 * Generates the interface or exception class for a structure.
 */
export class StructureGenerator {
  private readonly _model: Model;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _writer: TypeScriptWriter;
  private readonly _shape: StructureShape;
  private readonly _includeValidation: boolean;
  private readonly _requiredMemberMode: RequiredMemberMode;
  private readonly _sensitiveDataFinder: SensitiveDataFinder;
  private readonly _schemaMode: boolean;

  public constructor(
    model: Model,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter,
    shape: StructureShape,
    includeValidation = false,
    requiredMemberMode: RequiredMemberMode = "nullable",
    schemaMode = false
  ) {
    this._model = model;
    this._symbolProvider = symbolProvider;
    this._writer = writer;
    this._shape = shape;
    this._includeValidation = includeValidation;
    this._requiredMemberMode = requiredMemberMode;
    this._sensitiveDataFinder = new SensitiveDataFinder(model);
    this._schemaMode = schemaMode;
  }

  public run(): void {
    if (this._shape.hasTrait(ErrorTrait)) {
      this._renderErrorStructure();
    } else {
      this._renderNonErrorStructure();
    }
  }

  private _renderNonErrorStructure(): void {
    const writer = this._writer;
    const symbol = this._symbolProvider.toSymbol(this._shape);
    writer.writeShapeDocs(documentedShape(this._shape));

    const extendsFrom = symbol
      .getReferences()
      .filter((ref) => ref.getProperty(IMPLEMENTS_INTERFACE_PROPERTY) !== undefined)
      .map((ref) => ref.getAlias())
      .join(", ");

    const config = new StructuredMemberWriter(
      this._model,
      this._symbolProvider,
      this._shape.getAllMembers().values(),
      this._requiredMemberMode,
      this._sensitiveDataFinder
    );
    if (config.members.length === 0) {
      writer.write("export interface $L {}", symbol.getName());
    } else {
      if (extendsFrom === "") {
        writer.openBlock("export interface $L {", symbol.getName());
      } else {
        writer.openBlock("export interface $L extends $L {", symbol.getName(), extendsFrom);
      }
      config.writeMembers(writer, this._shape);
      writer.closeBlock("}");
    }
    writer.write("");
    this._renderStructureNamespace(config);
  }

  private _renderStructureNamespace(structuredMemberWriter: StructuredMemberWriter): void {
    const writer = this._writer;
    const symbol = this._symbolProvider.toSymbol(this._shape);
    const objectParam = "obj";
    if (this._sensitiveDataFinder.findsSensitiveDataIn(this._shape) && !this._schemaMode) {
      writer.writeDocs("@internal");
      writer.openBlock(
        "export const $LFilterSensitiveLog = ($L: $L): any => ({",
        "})",
        symbol.getName(),
        objectParam,
        symbol.getName(),
        () => {
          structuredMemberWriter.writeFilterSensitiveLog(writer, objectParam);
        }
      );
    }
    if (!this._includeValidation) {
      return;
    }
    throw new Error("Server validation namespaces are not ported");
  }

  private _renderErrorStructure(): void {
    const writer = this._writer;
    const errorTrait = this._shape.expectTrait(ErrorTrait);
    const symbol = this._symbolProvider.toSymbol(this._shape);
    writer.writeShapeDocs(documentedShape(this._shape));
    const isServerSdk = this._includeValidation;
    writer.openBlock("export class $T extends $L {", symbol, "__BaseException");
    writer.write("public static readonly shapeId: string = $1S;", this._shape.getId().toString());
    writer.write("readonly name = $1S as const;", this._shape.getId().getName());
    writer.write("readonly $$fault = $1S as const;", errorTrait.getValue());
    if (!isServerSdk) {
      writeRetryableTrait(writer, this._shape, ";");
    }
    const structuredMemberWriter = new StructuredMemberWriter(
      this._model,
      this._symbolProvider,
      this._shape.getAllMembers().values(),
      this._requiredMemberMode,
      this._sensitiveDataFinder
    );
    structuredMemberWriter.skipMembers.add("message");
    structuredMemberWriter.writeMembers(writer, this._shape);
    structuredMemberWriter.writeErrorConstructor(writer, this._shape, isServerSdk);
    writer.closeBlock("}");
    writer.write("");
  }
}

/** Writes the `$retryable` property of an error shape. */
function writeRetryableTrait(writer: TypeScriptWriter, error: StructureShape, separator: string): void {
  const retryableTrait = error.getTrait(RetryableTrait);
  if (retryableTrait !== undefined) {
    writer.openCollapsibleBlock("$$retryable = {", `}${separator}`, retryableTrait.getThrottling(), () => {
      if (retryableTrait.getThrottling()) {
        writer.write("throttling: true,");
      }
    });
  }
}
