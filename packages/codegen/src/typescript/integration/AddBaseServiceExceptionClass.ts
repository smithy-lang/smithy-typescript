import { Symbol, SymbolReference, ContextOption, type SymbolProvider } from "../../codegen-core";
import { ErrorTrait, type Model, type Shape } from "../../model";
import { CodegenUtils } from "../CodegenUtils";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import type { TypeScriptCodegenContext } from "../TypeScriptCodegenContext";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

/**
 * Generates the synthetic base exception class that all service errors extend.
 */
export class AddBaseServiceExceptionClass extends TypeScriptIntegration {
  public customize(codegenContext: TypeScriptCodegenContext): void {
    const settings = codegenContext.settings();
    const model = codegenContext.model();
    const symbolProvider = codegenContext.symbolProvider();
    const delegator = codegenContext.writerDelegator();
    this._writeAdditionalFiles(settings, model, symbolProvider, (file, consumer) =>
      delegator.useFileWriter(file, consumer)
    );
    delegator.useFileWriter([CodegenUtils.SOURCE_FOLDER, "index.ts"].join("/"), (writer) => {
      this._writeAdditionalExports(settings, model, symbolProvider, writer);
    });
  }

  public decorateSymbolProvider(
    model: Model,
    settings: TypeScriptSettings,
    symbolProvider: SymbolProvider
  ): SymbolProvider {
    return {
      toSymbol: (shape: Shape): Symbol => {
        const symbol = symbolProvider.toSymbol(shape);
        if (!shape.hasTrait(ErrorTrait)) {
          return symbol;
        }
        let baseExceptionSymbol: Symbol;
        if (settings.getOptionalService() === undefined) {
          baseExceptionSymbol = Symbol.builder()
            .name("ServiceException")
            .namespace(TypeScriptDependency.SMITHY_CORE.packageName + SmithyCoreSubmodules.CLIENT, "/")
            .addDependency(TypeScriptDependency.SMITHY_CORE)
            .build();
        } else if (settings.generateClient()) {
          const serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
          const serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
          const namespace = [".", "src", "models", serviceExceptionName].join("/");
          baseExceptionSymbol = Symbol.builder()
            .name(serviceExceptionName)
            .namespace(namespace, "/")
            .definitionFile(namespace + ".ts")
            .build();
        } else {
          baseExceptionSymbol = TypeScriptDependency.SERVER_COMMON.createSymbol("ServiceException");
        }
        const reference = SymbolReference.builder()
          .options(ContextOption.USE)
          .alias("__BaseException")
          .symbol(baseExceptionSymbol)
          .build();
        return symbol.toBuilder().addReference(reference).build();
      },
      toMemberName: (member) => symbolProvider.toMemberName?.(member) ?? member.getMemberName(),
    };
  }

  private _isSchemaServer(settings: TypeScriptSettings): boolean {
    return (
      settings.generateServerSdk() &&
      (settings.generateServerSchemas() || (settings.getProtocol() !== undefined && settings.generateSchemas()))
    );
  }

  private _writeAdditionalFiles(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    writerFactory: (file: string, consumer: (writer: TypeScriptWriter) => void) => void
  ): void {
    if (!settings.generateClient() && !this._isSchemaServer(settings)) {
      return;
    }
    const serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
    const serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
    const serviceNamespace = settings.getService(model).getId().getNamespace();
    writerFactory([CodegenUtils.SOURCE_FOLDER, "models", serviceExceptionName + ".ts"].join("/"), (writer) => {
      writer.addImportSubmodule(
        "ServiceException",
        "__ServiceException",
        TypeScriptDependency.SMITHY_CORE,
        SmithyCoreSubmodules.CLIENT
      );
      writer.addTypeImportSubmodule(
        "ServiceExceptionOptions",
        "__ServiceExceptionOptions",
        TypeScriptDependency.SMITHY_CORE,
        SmithyCoreSubmodules.CLIENT
      );
      writer.write("export type { __ServiceExceptionOptions };\n");
      writer.write("export { __ServiceException };\n");
      writer.writeDocs(`@public\n\nBase exception class for all service exceptions from ${serviceName} service.`);
      writer.openBlock("export class $L extends __ServiceException {", serviceExceptionName);
      writer.write(
        "public static readonly shapeId: string = $S;",
        `smithy.ts.sdk.synthetic.${serviceNamespace}#${serviceExceptionName}`
      );
      writer.writeDocs("@internal");
      writer.openBlock("constructor(options: __ServiceExceptionOptions) {");
      writer.write("super(options);");
      writer.write("Object.setPrototypeOf(this, $L.prototype);", serviceExceptionName);
      writer.closeBlock("}");
      writer.closeBlock("}");
    });
  }

  private _writeAdditionalExports(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    if (!settings.generateClient() && !this._isSchemaServer(settings)) {
      return;
    }
    const serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
    const serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
    writer.write('export { $1L } from "./models/$1L";', serviceExceptionName);
  }
}
