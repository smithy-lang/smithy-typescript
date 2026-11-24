import { CodegenException, type FileManifest, type Symbol, type SymbolProvider } from "../codegen-core";
import {
  type Model,
  type OperationShape,
  PaginatedIndex,
  PaginatedTrait,
  type ServiceShape,
  TopDownIndex,
} from "../model";
import { CodegenUtils } from "./CodegenUtils";
import { TypeScriptDependency } from "./TypeScriptDependency";
import { TypeScriptWriter } from "./TypeScriptWriter";
import type { PaginationInfo } from "../model";

const PAGINATION_FOLDER = "pagination";

/**
 * Generates paginator functions for paginated operations.
 */
export class PaginationGenerator {
  public static readonly PAGINATION_INTERFACE_FILE = [
    CodegenUtils.SOURCE_FOLDER,
    PAGINATION_FOLDER,
    "Interfaces.ts",
  ].join("/");

  private readonly _writer: TypeScriptWriter;
  private readonly _aggregatedClientName: string;
  private readonly _paginatedInfo: PaginationInfo;
  private readonly _serviceSymbol: Symbol;
  private readonly _operationSymbol: Symbol;
  private readonly _inputSymbol: Symbol;
  private readonly _outputSymbol: Symbol;
  private readonly _operationName: string;
  private readonly _paginationType: string;

  public constructor(
    model: Model,
    service: ServiceShape,
    operation: OperationShape,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter,
    aggregatedClientName: string
  ) {
    this._writer = writer;
    this._aggregatedClientName = aggregatedClientName;
    this._serviceSymbol = symbolProvider.toSymbol(service);
    this._operationSymbol = symbolProvider.toSymbol(operation);
    this._inputSymbol = this._operationSymbol.expectProperty<Symbol>("inputType");
    this._outputSymbol = this._operationSymbol.expectProperty<Symbol>("outputType");
    this._operationName = operation.getId().getName();
    this._paginationType = aggregatedClientName + "PaginationConfiguration";
    const paginationInfo = PaginatedIndex.of(model).getPaginationInfo(service, operation);
    if (paginationInfo === undefined) {
      throw new CodegenException("Expected Paginator to have pagination information.");
    }
    this._paginatedInfo = paginationInfo;
  }

  public static getOutputFileLocation(operation: OperationShape): string {
    return [CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER, operation.getId().getName() + "Paginator.ts"].join("/");
  }

  public static generateServicePaginationInterfaces(
    aggregatedClientName: string,
    service: Symbol,
    writer: TypeScriptWriter
  ): void {
    writer.addTypeImport("PaginationConfiguration", null, TypeScriptDependency.SMITHY_TYPES);
    writer.addRelativeImport(service.getName(), service.getName(), "./" + service.getNamespace());
    writer
      .writeDocs("@public")
      .openBlock(
        "export interface $LPaginationConfiguration extends PaginationConfiguration {",
        "}",
        aggregatedClientName,
        () => {
          writer.write("client: $L;", service.getName());
        }
      );
  }

  public static writeIndex(model: Model, service: ServiceShape, fileManifest: FileManifest): void {
    const writer = new TypeScriptWriter("");
    writer.write(
      'export * from "./$L";',
      PaginationGenerator._getModulePath(PaginationGenerator.PAGINATION_INTERFACE_FILE)
    );
    const containedOperations = TopDownIndex.of(model).getContainedOperations(service);
    for (const operation of containedOperations) {
      if (operation.hasTrait(PaginatedTrait)) {
        writer.write(
          'export * from "./$L";',
          PaginationGenerator._getModulePath(PaginationGenerator.getOutputFileLocation(operation))
        );
      }
    }
    fileManifest.writeFile([CodegenUtils.SOURCE_FOLDER, PAGINATION_FOLDER, "index.ts"].join("/"), writer.toString());
  }

  public run(): void {
    const writer = this._writer;
    for (const symbol of [this._operationSymbol, this._inputSymbol, this._outputSymbol, this._serviceSymbol]) {
      writer.addRelativeImport(symbol.getName(), symbol.getName(), "./" + symbol.getNamespace());
    }
    writer.addTypeImport("Paginator", null, TypeScriptDependency.SMITHY_TYPES);
    writer.addRelativeTypeImport(
      this._paginationType,
      this._paginationType,
      "./" + PaginationGenerator.PAGINATION_INTERFACE_FILE.replace(".ts", "")
    );
    this._writePager();
  }

  private static _getModulePath(fileLocation: string): string {
    return fileLocation.substring(fileLocation.lastIndexOf("/") + 1).replace(".ts", "");
  }

  private _writePager(): void {
    const writer = this._writer;
    const trait = this._paginatedInfo.getPaginatedTrait();
    writer.addDependency(TypeScriptDependency.SMITHY_CORE);
    writer.addImport("createPaginator", null, TypeScriptDependency.SMITHY_CORE);
    writer.writeDocs("@public");
    writer
      .pushState()
      .putContext("operation", this._operationName)
      .putContext("aggClient", this._aggregatedClientName)
      .putContext("inputType", this._inputSymbol.getName())
      .putContext("outputType", this._outputSymbol.getName())
      .putContext("paginationType", this._paginationType)
      .putContext("serviceTypeName", this._serviceSymbol.getName())
      .putContext("operationName", this._operationSymbol.getName())
      .putContext("inputToken", trait.getInputToken())
      .putContext("outputToken", trait.getOutputToken())
      .putContext("pageSizeMember", this._paginatedInfo.getPageSizeMember()?.getMemberName() ?? "")
      .write(
        "export const paginate${operation:L}: (\n  config: ${aggClient:L}PaginationConfiguration,\n  input: ${inputType:L},\n  ...rest: any[]\n) => Paginator<${outputType:L}> = createPaginator<\n  ${paginationType:L},\n  ${inputType:L},\n  ${outputType:L}\n>(${serviceTypeName:L}, ${operationName:L}, ${inputToken:S}, ${outputToken:S}, ${pageSizeMember:S});\n"
      )
      .popState();
  }
}
