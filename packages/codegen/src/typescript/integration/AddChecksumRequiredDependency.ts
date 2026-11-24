import type { SymbolProvider } from "../../codegen-core";
import {
  HttpChecksumRequiredTrait,
  type Model,
  type OperationShape,
  type ServiceShape,
  TopDownIndex,
} from "../../model";
import { LanguageTarget } from "../LanguageTarget";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { RuntimeClientPlugin } from "./RuntimeClientPlugin";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

const hasChecksumRequiredTrait = (_model: Model, _service: ServiceShape, operation: OperationShape): boolean =>
  operation.hasTrait(HttpChecksumRequiredTrait);

const hasMd5Dependency = (model: Model, service: ServiceShape): boolean =>
  TopDownIndex.of(model)
    .getContainedOperations(service)
    .some((operation) => hasChecksumRequiredTrait(model, service, operation));

/**
 * Adds MD5 checksum support for operations that require it.
 */
export class AddChecksumRequiredDependency extends TypeScriptIntegration {
  public addConfigInterfaceFields(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    if (!hasMd5Dependency(model, settings.getService(model))) {
      return;
    }
    writer.addImport("Readable", null, "stream");
    writer.addTypeImport("StreamHasher", "__StreamHasher", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs(
      "A function that, given a hash constructor and a stream, calculates the \nhash of the streamed value.\n@internal"
    );
    writer.write("streamHasher?: __StreamHasher<Readable> | __StreamHasher<Blob>;\n");
    writer.addTypeImport("HashConstructor", "__HashConstructor", TypeScriptDependency.SMITHY_TYPES);
    writer.addTypeImport("Checksum", "__Checksum", TypeScriptDependency.SMITHY_TYPES);
    writer.addTypeImport("ChecksumConstructor", "__ChecksumConstructor", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs(
      "A constructor for a class implementing the {@link __Checksum} interface\nthat computes MD5 hashes.\n@internal"
    );
    writer.write("md5?: __ChecksumConstructor | __HashConstructor;\n");
  }

  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!hasMd5Dependency(model, settings.getService(model))) {
      return new Map();
    }
    switch (target) {
      case LanguageTarget.SHARED:
        return new Map([
          [
            "md5",
            (writer) => {
              writer.addDependency(TypeScriptDependency.SMITHY_CORE);
              writer.addImportSubmodule("Md5", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CHECKSUM);
              writer.write("Md5");
            },
          ],
        ]);
      case LanguageTarget.NODE:
        return new Map([["streamHasher", streamHasherWriter("fileStreamHasher")]]);
      case LanguageTarget.BROWSER:
        return new Map([["streamHasher", streamHasherWriter("blobHasher")]]);
      default:
        return new Map();
    }
  }

  public getClientPlugins(): RuntimeClientPlugin[] {
    return [
      RuntimeClientPlugin.builder()
        .withConventions(TypeScriptDependency.BODY_CHECKSUM.dependency, "ApplyMd5BodyChecksum", "HAS_MIDDLEWARE")
        .operationPredicate(hasChecksumRequiredTrait)
        .build(),
    ];
  }
}

const streamHasherWriter = (importName: string) => (writer: TypeScriptWriter) => {
  writer.addDependency(TypeScriptDependency.SMITHY_CORE);
  writer.addImportSubmodule(
    importName,
    "streamHasher",
    TypeScriptDependency.SMITHY_CORE,
    SmithyCoreSubmodules.CHECKSUM
  );
  writer.write("streamHasher");
};
