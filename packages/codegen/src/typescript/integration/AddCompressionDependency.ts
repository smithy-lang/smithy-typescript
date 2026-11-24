import type { SymbolProvider } from "../../codegen-core";
import {
  type Model,
  type OperationShape,
  RequestCompressionTrait,
  type ServiceShape,
  TopDownIndex,
  TreeMap,
} from "../../model";
import { LanguageTarget } from "../LanguageTarget";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { RuntimeClientPlugin } from "./RuntimeClientPlugin";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

const hasRequestCompressionOnOperation = (operation: OperationShape): boolean =>
  operation.hasTrait(RequestCompressionTrait);

const hasRequestCompressionTrait = (model: Model, service: ServiceShape): boolean =>
  TopDownIndex.of(model).getContainedOperations(service).some(hasRequestCompressionOnOperation);

const loadNodeConfigImport = (writer: TypeScriptWriter): void => {
  writer.addImportSubmodule(
    "loadConfig",
    "loadNodeConfig",
    TypeScriptDependency.SMITHY_CORE,
    SmithyCoreSubmodules.CONFIG
  );
};

/**
 * Adds request compression config and middleware.
 */
export class AddCompressionDependency extends TypeScriptIntegration {
  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!hasRequestCompressionTrait(model, settings.getService(model))) {
      return new Map();
    }
    switch (target) {
      case LanguageTarget.NODE:
        return new Map([
          [
            "disableRequestCompression",
            (writer) => {
              loadNodeConfigImport(writer);
              writer.addImport(
                "NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS",
                null,
                TypeScriptDependency.MIDDLEWARE_COMPRESSION
              );
              writer.write("loadNodeConfig(NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS, config)");
            },
          ],
          [
            "requestMinCompressionSizeBytes",
            (writer) => {
              loadNodeConfigImport(writer);
              writer.addImport(
                "NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS",
                null,
                TypeScriptDependency.MIDDLEWARE_COMPRESSION
              );
              writer.write("loadNodeConfig(NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS, config)");
            },
          ],
        ]);
      case LanguageTarget.BROWSER:
        return new Map([
          [
            "disableRequestCompression",
            (writer) => {
              writer.addImport(
                "DEFAULT_DISABLE_REQUEST_COMPRESSION",
                null,
                TypeScriptDependency.MIDDLEWARE_COMPRESSION
              );
              writer.write("DEFAULT_DISABLE_REQUEST_COMPRESSION");
            },
          ],
          [
            "requestMinCompressionSizeBytes",
            (writer) => {
              writer.addImport(
                "DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES",
                null,
                TypeScriptDependency.MIDDLEWARE_COMPRESSION
              );
              writer.write("DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES");
            },
          ],
        ]);
      default:
        return new Map();
    }
  }

  public getClientPlugins(): RuntimeClientPlugin[] {
    return [
      RuntimeClientPlugin.builder()
        .withConventions(TypeScriptDependency.MIDDLEWARE_COMPRESSION.dependency, "Compression", "HAS_CONFIG")
        .servicePredicate(hasRequestCompressionTrait)
        .build(),
      RuntimeClientPlugin.builder()
        .withConventions(TypeScriptDependency.MIDDLEWARE_COMPRESSION.dependency, "Compression", "HAS_MIDDLEWARE")
        .additionalPluginFunctionParamsSupplier((_m, _s, operation) => {
          const params = new TreeMap<string, unknown>();
          params.set("encodings", operation.expectTrait(RequestCompressionTrait).getEncodings());
          return params;
        })
        .operationPredicate((_m, _s, operation) => hasRequestCompressionOnOperation(operation))
        .build(),
    ];
  }
}
