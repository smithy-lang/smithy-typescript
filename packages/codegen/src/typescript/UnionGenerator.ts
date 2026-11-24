import type { SymbolProvider } from "../codegen-core";
import type { MemberShape, Model, UnionShape } from "../model";
import { TreeMap } from "../model";
import { documentedMember, documentedShape } from "./documentation/ShapeDocs";
import { StructuredMemberWriter } from "./StructuredMemberWriter";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { SensitiveDataFinder } from "./validation/SensitiveDataFinder";

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Generates the type, namespace and visitor for a union.
 */
export class UnionGenerator {
  private readonly _model: Model;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _writer: TypeScriptWriter;
  private readonly _shape: UnionShape;
  private readonly _symbol;
  private readonly _variantMap = new TreeMap<string, string>();
  private readonly _includeValidation: boolean;
  private readonly _sensitiveDataFinder: SensitiveDataFinder;
  private readonly _schemaMode: boolean;

  public constructor(
    model: Model,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter,
    shape: UnionShape,
    includeValidation = false,
    schemaMode = false
  ) {
    this._shape = shape;
    this._symbol = symbolProvider.toSymbol(shape);
    this._model = model;
    this._symbolProvider = symbolProvider;
    this._writer = writer;
    this._includeValidation = includeValidation;
    this._sensitiveDataFinder = new SensitiveDataFinder(model);
    this._schemaMode = schemaMode;

    const targetSymbolNames = new Set<string>();
    for (const member of shape.getAllMembers().values()) {
      targetSymbolNames.add(symbolProvider.toSymbol(member).getName());
    }
    const usedVariantNames = new Set<string>();
    for (const member of shape.getAllMembers().values()) {
      let variant = capitalize(this._memberName(member)) + "Member";
      while (targetSymbolNames.has(variant) || usedVariantNames.has(variant)) {
        variant = "_" + variant;
      }
      usedVariantNames.add(variant);
      this._variantMap.set(member.getMemberName(), variant);
    }
  }

  public run(): void {
    const writer = this._writer;
    const symbol = this._symbol;
    writer.writeShapeDocs(documentedShape(this._shape));
    writer.openBlock("export type $L = ", "", symbol.getName(), () => {
      for (const variant of this._variantMap.values()) {
        writer.write("| $L.$L", symbol.getName(), variant);
      }
      writer.write("| $L.$$UnknownMember;", symbol.getName());
    });
    writer.writeDocs("@public").openBlock("export namespace $L {", "}", symbol.getName(), () => {
      this._writeUnionMemberInterfaces();
      this._writeVisitorType();
      this._writeVisitorFunction();
      if (this._includeValidation) {
        throw new Error("Server validation namespaces are not ported");
      }
      writer.unwrite("\n");
    });
    this._writeFilterSensitiveLog(symbol.getName());
  }

  private _memberName(member: MemberShape): string {
    return this._symbolProvider.toMemberName?.(member) ?? member.getMemberName();
  }

  private _writeUnionMemberInterfaces(): void {
    const writer = this._writer;
    for (const member of this._shape.getAllMembers().values()) {
      const name = this._variantMap.get(member.getMemberName())!;
      writer.writeMemberDocs(documentedMember(this._model, member));
      writer.openBlock("export interface $L {", "}", name, () => {
        for (const variantMember of this._shape.getAllMembers().values()) {
          if (variantMember.getMemberName() === member.getMemberName()) {
            writer.write("$L: $T;", this._memberName(variantMember), this._symbolProvider.toSymbol(variantMember));
          } else {
            writer.write("$L?: never;", this._memberName(variantMember));
          }
        }
        writer.write("$$unknown?: never;");
      });
      writer.write("");
    }
    writer.writeDocs("@public");
    writer.openBlock("export interface $$UnknownMember {", "}", () => {
      for (const member of this._shape.getAllMembers().values()) {
        writer.write("$L?: never;", this._memberName(member));
      }
      writer.write("$$unknown: [string, any];");
    });
    writer.write("");
  }

  private _writeVisitorType(): void {
    const writer = this._writer;
    if (this._schemaMode) {
      writer.writeDocs("@deprecated unused in schema-serde mode.\n");
    }
    writer.openBlock("export interface Visitor<T> {", "}", () => {
      for (const member of this._shape.getAllMembers().values()) {
        writer.write("$L: (value: $T) => T;", this._memberName(member), this._symbolProvider.toSymbol(member));
      }
      writer.write("_: (name: string, value: any) => T;");
    });
    writer.write("");
  }

  private _writeVisitorFunction(): void {
    const writer = this._writer;
    if (!this._schemaMode) {
      writer.writeInline("export const visit = <T>(");
      writer.writeInline("value: $L, ", this._symbol.getName());
      writer.writeInline("visitor: Visitor<T>");
      writer.write("): T => {").indent();
      for (const member of this._shape.getAllMembers().values()) {
        const memberName = this._memberName(member);
        writer.write("if (value.${1L} !== undefined) return visitor.$1L(value.${1L});", memberName);
      }
      writer.write("return visitor._(value.$$unknown[0], value.$$unknown[1]);");
      writer.dedent().write("};");
      writer.write("");
    }
  }

  private _writeFilterSensitiveLog(namespace: string): void {
    if (!this._sensitiveDataFinder.findsSensitiveDataIn(this._shape) || this._schemaMode) {
      return;
    }
    const writer = this._writer;
    const objectParam = "obj";
    writer.writeDocs("@internal");
    writer.openBlock(
      "export const $LFilterSensitiveLog = ($L: $L): any => {",
      "}",
      namespace,
      objectParam,
      this._symbol.getName(),
      () => {
        for (const member of this._shape.getAllMembers().values()) {
          const memberName = this._memberName(member);
          const structuredMemberWriter = new StructuredMemberWriter(
            this._model,
            this._symbolProvider,
            this._shape.getAllMembers().values(),
            "nullable",
            this._sensitiveDataFinder
          );
          writer.writeInline("if (${1L}.${2L} !== undefined) {\n  return {\n    ${2L}: ", objectParam, memberName);
          writer.indent(2);
          structuredMemberWriter.writeMemberFilterSensitiveLog(writer, member, `${objectParam}.${memberName}`);
          writer.dedent(1);
          writer.write("};");
          writer.dedent(1);
          writer.write("}");
        }
        writer.write('if (${1L}.$$unknown !== undefined) return { [${1L}.$$unknown[0]]: "UNKNOWN" };', objectParam);
      }
    );
  }
}
