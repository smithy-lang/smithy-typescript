import { CodegenException, Symbol, type SymbolProvider } from "../codegen-core";
import { HttpPayloadTrait, type MemberShape, type Model, StreamingTrait, type StructureShape, TreeMap } from "../model";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptWriter } from "./TypeScriptWriter";

interface MemberLike {
  getMemberName(): string;
  isRequired(): boolean;
}

interface StructureShapeLike {
  getId(): { getName(): string };
}

interface ModelWithStructures {
  getStructureShapes(): Iterable<StructureShapeLike>;
}

/**
 * Utility methods needed across generators.
 *
 * @internal
 */
export class CodegenUtils {
  public static readonly SOURCE_FOLDER = "src";
  public static readonly TEST_FOLDER = "test";

  private constructor() {}

  public static isJsonMediaType(mediaType: string): boolean {
    return mediaType === "application/json" || mediaType.endsWith("+json");
  }

  public static getBlobStreamingMembers(model: Model, shape: StructureShape): MemberShape[] {
    return [...shape.getAllMembers().values()].filter((member) => {
      const target = model.expectShape(member.getTarget());
      return target.isBlobShape() && target.hasTrait(StreamingTrait);
    });
  }

  public static getBlobPayloadMembers(model: Model, shape: StructureShape): MemberShape[] {
    return [...shape.getAllMembers().values()].filter((member) => {
      const target = model.expectShape(member.getTarget());
      return target.isBlobShape() && member.hasTrait(HttpPayloadTrait) && !target.hasTrait(StreamingTrait);
    });
  }

  public static getServiceName(settings: TypeScriptSettings, model: Model, symbolProvider: SymbolProvider): string {
    const service = settings.getService(model);
    return symbolProvider
      .toSymbol(service)
      .getName()
      .replace(/(Client)$/, "");
  }

  public static writeClientCommandStreamingInputType(
    writer: TypeScriptWriter,
    containerSymbol: Symbol,
    typeName: string,
    streamingMember: MemberLike,
    commandName: string
  ): void {
    writer.addTypeImport("StreamingBlobPayloadInputTypes", null, TypeScriptDependency.SMITHY_TYPES);
    const memberName = streamingMember.getMemberName();
    const optionalSuffix = streamingMember.isRequired() ? "" : "?";

    writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
    writer.write(
      "export interface $L extends Omit<$T, $S> {\n" + "  $L$L: StreamingBlobPayloadInputTypes;\n" + "}\n",
      typeName,
      containerSymbol,
      memberName,
      memberName,
      optionalSuffix
    );
  }

  public static writeClientCommandStreamingOutputType(
    writer: TypeScriptWriter,
    containerSymbol: Symbol,
    typeName: string,
    streamingMember: MemberLike,
    commandName: string
  ): void {
    const memberName = streamingMember.getMemberName();
    const optionalSuffix = streamingMember.isRequired() ? "" : "?";
    writer.addTypeImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
    writer.addTypeImport("StreamingBlobPayloadOutputTypes", null, TypeScriptDependency.SMITHY_TYPES);

    writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
    writer.write(
      "export interface $L extends Omit<$T, $S>, __MetadataBearer {\n" +
        "  $L$L: StreamingBlobPayloadOutputTypes;\n" +
        "}\n",
      typeName,
      containerSymbol,
      memberName,
      memberName,
      optionalSuffix
    );
  }

  public static writeClientCommandBlobPayloadInputType(
    writer: TypeScriptWriter,
    containerSymbol: Symbol,
    typeName: string,
    payloadMember: MemberLike,
    commandName: string
  ): void {
    const memberName = payloadMember.getMemberName();
    const optionalSuffix = payloadMember.isRequired() ? "" : "?";

    writer.addTypeImport("BlobPayloadInputTypes", null, TypeScriptDependency.SMITHY_TYPES);

    writer.writeDocs("@public");
    writer.write(
      "export type $LType = Omit<$T, $S> & {\n  $L: BlobPayloadInputTypes;\n};\n",
      typeName,
      containerSymbol,
      memberName,
      memberName + optionalSuffix
    );

    writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
    writer.write("export interface $1L extends $1LType {}", typeName);
  }

  public static writeClientCommandBlobPayloadOutputType(
    writer: TypeScriptWriter,
    containerSymbol: Symbol,
    typeName: string,
    payloadMember: MemberLike,
    commandName: string
  ): void {
    const memberName = payloadMember.getMemberName();
    const optionalSuffix = payloadMember.isRequired() ? "" : "?";

    writer.addImportSubmodule(
      "Uint8ArrayBlobAdapter",
      null,
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.SERDE
    );
    writer.addDependency(TypeScriptDependency.SMITHY_CORE);

    writer.writeDocs("@public");
    writer.write(
      "export type $LType = Omit<$T, $S> & {\n  $L: Uint8ArrayBlobAdapter;\n};\n",
      typeName,
      containerSymbol,
      memberName,
      memberName + optionalSuffix
    );

    writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
    writer.write("export interface $1L extends $1LType, __MetadataBearer {}", typeName);
  }

  public static getFunctionParametersList(paramsMap: Map<string, unknown>): string[] {
    const functionParametersList: string[] = [];
    const sorted = new TreeMap<string, unknown>(null, paramsMap);

    for (const [key, value] of sorted) {
      if (value instanceof Symbol) {
        const symbolName = value.getName();
        if (key === symbolName) {
          functionParametersList.push(`$${symbolName}:T`);
        } else {
          functionParametersList.push(`${key}: $${key}:T`);
        }
      } else if (typeof value === "string") {
        functionParametersList.push(`${key}: '${value}'`);
      } else if (typeof value === "number" || typeof value === "boolean") {
        functionParametersList.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] !== "string") {
          throw new CodegenException("Plugin function parameters list must be List<String>");
        }
        functionParametersList.push(`'${key}': [${value.map((item) => `'${item}'`).join(", ")}]`);
      } else if (value instanceof Map) {
        const entries = Array.from(value.entries());
        if (entries.some(([k]) => typeof k !== "string") && entries.some(([, v]) => typeof v !== "string")) {
          throw new CodegenException("Plugin function parameters map must be Map<String, String>");
        }
        functionParametersList.push(`${key}: {${entries.map(([k, v]) => `'${k}': '${v}'`).join(", ")}}`);
      } else {
        throw new CodegenException(
          "Plugin function parameters not supported for type " + (value as object | null)?.constructor?.name
        );
      }
    }

    return functionParametersList;
  }

  public static getServiceExceptionName(serviceName: string): string {
    return serviceName + "ServiceException";
  }

  public static getSyntheticBaseExceptionName(serviceName: string, model: ModelWithStructures): string {
    let serviceExceptionName = CodegenUtils.getServiceExceptionName(serviceName);
    for (;;) {
      const current = serviceExceptionName;
      let collision = false;
      for (const structure of model.getStructureShapes()) {
        if (structure.getId().getName() === current) {
          collision = true;
          break;
        }
      }
      if (!collision) {
        break;
      }
      serviceExceptionName = serviceExceptionName.replace(/ServiceException$/, "SyntheticServiceException");
    }
    return serviceExceptionName;
  }
}
