import { CodegenException, type SymbolProvider } from "../codegen-core";
import type { MemberShape, Model, Shape, StructureShape } from "../model";
import { ErrorTrait, MapShape, SensitiveTrait, StreamingTrait } from "../model";
import { documentedMember } from "./documentation/ShapeDocs";
import { ServiceClosure } from "./knowledge/ServiceClosure";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { RequiredMemberMode } from "./TypeScriptSettings";
import { TypeScriptUtils } from "./TypeScriptUtils";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { SensitiveDataFinder } from "./validation/SensitiveDataFinder";

const SIMPLE_TYPES = new Set([
  "blob",
  "boolean",
  "string",
  "timestamp",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "bigInteger",
  "bigDecimal",
  "document",
  "enum",
  "intEnum",
]);

const isSimple = (shape: Shape): boolean => SIMPLE_TYPES.has(shape.getType());
const isCollection = (shape: Shape): boolean => shape.isListShape() || shape.isSetShape();

/**
 * Writes the members of structures and unions, along with sensitive-data filters.
 */
export class StructuredMemberWriter {
  public readonly model: Model;
  public readonly symbolProvider: SymbolProvider;
  public readonly members: MemberShape[];
  public memberPrefix = "";
  public noDocs = false;
  public readonly requiredMemberMode: RequiredMemberMode;
  public readonly skipMembers = new Set<string>();
  private readonly _sensitiveDataFinder: SensitiveDataFinder;

  public constructor(
    model: Model,
    symbolProvider: SymbolProvider,
    members: Iterable<MemberShape>,
    requiredMemberMode: RequiredMemberMode = "nullable",
    sensitiveDataFinder: SensitiveDataFinder = new SensitiveDataFinder(model)
  ) {
    this.model = model;
    this.symbolProvider = symbolProvider;
    this.members = [...new Set(members)];
    this.requiredMemberMode = requiredMemberMode;
    this._sensitiveDataFinder = sensitiveDataFinder;
  }

  public writeMembers(writer: TypeScriptWriter, shape: Shape): void {
    let position = -1;
    for (const member of this.members) {
      if (this.skipMembers.has(member.getMemberName())) {
        continue;
      }
      position++;
      const wroteDocs = !this.noDocs && writer.writeMemberDocs(documentedMember(this.model, member));
      const memberName = this._getSanitizedMemberName(member);
      const optionalSuffix = shape.isUnionShape() || !ServiceClosure.isMemberRequiredInClient(member) ? "?" : "";
      let typeSuffix =
        this.requiredMemberMode === "nullable" && ServiceClosure.isMemberRequiredInClient(member) ? " | undefined" : "";
      if (optionalSuffix === "?") {
        typeSuffix = " | undefined";
      }
      writer.write(
        "${L}${L}${L}: ${T}${L};",
        this.memberPrefix,
        memberName,
        optionalSuffix,
        this.symbolProvider.toSymbol(member).toBuilder().putProperty("typeOnly", true).build(),
        typeSuffix
      );
      if (wroteDocs && position < this.members.length - 1) {
        writer.write("");
      }
    }
  }

  public writeFilterSensitiveLog(writer: TypeScriptWriter, objectParam: string): void {
    writer.write("...$L,", objectParam);
    for (const member of this.members) {
      if (this._isMemberOverwriteRequired(member, new Set())) {
        const memberName = this._getSanitizedMemberName(member);
        writer.openBlock("...($1L.$2L && { $2L: ", "}),", objectParam, memberName, () => {
          this.writeMemberFilterSensitiveLog(writer, member, `${objectParam}.${memberName}`);
        });
      }
    }
  }

  public writeMemberFilterSensitiveLog(writer: TypeScriptWriter, member: MemberShape, memberParam: string): void {
    const memberTarget = this.model.expectShape(member.getTarget());
    if (member.getMemberTrait(this.model, SensitiveTrait) !== undefined) {
      this._writeSensitiveString(writer);
    } else if (isSimple(memberTarget)) {
      writer.write(memberParam);
    } else if (memberTarget.isStructureShape() || memberTarget.isUnionShape()) {
      this._writeStructureFilterSensitiveLog(writer, memberTarget, memberParam);
    } else if (isCollection(memberTarget)) {
      const collectionMember = (memberTarget.asListShape() ?? memberTarget.asSetShape())!.getMember();
      this._writeCollectionFilterSensitiveLog(writer, collectionMember, memberParam);
    } else if (memberTarget instanceof MapShape) {
      this._writeMapFilterSensitiveLog(writer, memberTarget.getValue(), memberParam);
    } else {
      throw new CodegenException(`MemberFilterSensitiveLog attempted for ${memberTarget.getType()}`);
    }
  }

  public writeErrorConstructor(writer: TypeScriptWriter, shape: Shape, isServerSdk: boolean): void {
    const errorTrait = shape.getTrait(ErrorTrait);
    if (errorTrait === undefined) {
      throw new Error("Expected an error shape");
    }
    const symbol = this.symbolProvider.toSymbol(shape);
    if (!isServerSdk) {
      writer.writeDocs("@internal");
    }
    writer.addTypeImportSubmodule(
      "ExceptionOptionType",
      "__ExceptionOptionType",
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.CLIENT
    );
    writer.openBlock("constructor(opts: __ExceptionOptionType<$L, __BaseException>) {", symbol.getName());
    writer.openBlock("super({", "});", () => {
      writer.write("name: $S,", shape.getId().getName());
      writer.write("$$fault: $S,", errorTrait.getValue());
      writer.write("...opts,");
    });
    writer.write("Object.setPrototypeOf(this, $L.prototype);", symbol.getName());
    for (const member of this.members) {
      if (this.skipMembers.has(member.getMemberName())) {
        continue;
      }
      writer.write("this.${1L} = opts.${1L};", this._getSanitizedMemberName(member));
    }
    writer.closeBlock("}");
  }

  private _writeSensitiveString(writer: TypeScriptWriter): void {
    writer.addImportSubmodule("SENSITIVE_STRING", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
    writer.write("SENSITIVE_STRING");
  }

  private _writeStructureFilterSensitiveLog(
    writer: TypeScriptWriter,
    structureTarget: Shape,
    structureParam: string
  ): void {
    if (structureTarget.hasTrait(SensitiveTrait)) {
      this._writeSensitiveString(writer);
    } else if (structureTarget.hasTrait(StreamingTrait) && structureTarget.isUnionShape()) {
      writer.write("'STREAMING_CONTENT'");
    } else if (structureTarget.hasTrait(ErrorTrait)) {
      writer.write("$L", structureParam);
    } else if (this._sensitiveDataFinder.findsSensitiveDataIn(structureTarget)) {
      const symbol = this.symbolProvider.toSymbol(structureTarget);
      const filterFunctionName = symbol.getName() + "FilterSensitiveLog";
      if (!symbol.getNamespace().includes(writer.getModuleName())) {
        writer.addRelativeImport(filterFunctionName, null, "./" + symbol.getNamespace());
      }
      writer.write("$L($L)", filterFunctionName, structureParam);
    } else {
      writer.write("$L", structureParam);
    }
  }

  private _writeCollectionFilterSensitiveLog(
    writer: TypeScriptWriter,
    collectionMember: MemberShape,
    collectionParam: string
  ): void {
    if (collectionMember.getMemberTrait(this.model, SensitiveTrait) !== undefined) {
      this._writeSensitiveString(writer);
    } else if (isSimple(this.model.expectShape(collectionMember.getTarget()))) {
      writer.write(collectionParam);
    } else {
      writer.openBlock("$L.map(", ")", collectionParam, () => {
        const itemParam = "item";
        writer.write("$L => ", itemParam);
        this.writeMemberFilterSensitiveLog(writer, collectionMember, itemParam);
      });
    }
  }

  private _writeMapFilterSensitiveLog(writer: TypeScriptWriter, mapMember: MemberShape, mapParam: string): void {
    if (mapMember.getMemberTrait(this.model, SensitiveTrait) !== undefined) {
      this._writeSensitiveString(writer);
    } else if (isSimple(this.model.expectShape(mapMember.getTarget()))) {
      writer.write(mapParam);
    } else {
      const accParam = "acc";
      const keyParam = "key";
      const valueParam = "value";
      writer.openBlock(
        "Object.entries($L).reduce(($L: any, [$L, $L]: [string, $T]) => (",
        "), {})",
        mapParam,
        accParam,
        keyParam,
        valueParam,
        this.symbolProvider.toSymbol(mapMember),
        () => {
          writer.openBlock("$L[$L] =", "", accParam, keyParam, () => {
            this.writeMemberFilterSensitiveLog(writer, mapMember, valueParam);
            writer.writeInline(",");
          });
          writer.write(accParam);
        }
      );
    }
  }

  private _isMemberOverwriteRequired(member: MemberShape, parents: Set<string>): boolean {
    if (member.getMemberTrait(this.model, SensitiveTrait) !== undefined) {
      return true;
    }
    const memberTarget = this.model.expectShape(member.getTarget());
    if (memberTarget.isUnionShape()) {
      return true;
    }
    if (memberTarget.isStructureShape()) {
      const name = this.symbolProvider.toMemberName?.(member) ?? member.getMemberName();
      if (!parents.has(name)) {
        parents.add(name);
        for (const structureMember of (memberTarget as StructureShape).getAllMembers().values()) {
          const structureMemberName =
            this.symbolProvider.toMemberName?.(structureMember) ?? structureMember.getMemberName();
          if (!parents.has(structureMemberName) && this._isMemberOverwriteRequired(structureMember, parents)) {
            return true;
          }
        }
      }
    } else if (isCollection(memberTarget)) {
      return this._isMemberOverwriteRequired(
        (memberTarget.asListShape() ?? memberTarget.asSetShape())!.getMember(),
        parents
      );
    } else if (memberTarget instanceof MapShape) {
      return this._isMemberOverwriteRequired(memberTarget.getValue(), parents);
    }
    return false;
  }

  private _getSanitizedMemberName(member: MemberShape): string {
    return TypeScriptUtils.sanitizePropertyName(this.symbolProvider.toMemberName?.(member) ?? member.getMemberName());
  }
}
