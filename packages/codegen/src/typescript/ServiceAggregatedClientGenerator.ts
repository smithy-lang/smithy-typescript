import type { Symbol, SymbolProvider } from "../codegen-core";
import {
  type Model,
  type OperationShape,
  PaginatedTrait,
  type ServiceShape,
  TopDownIndex,
  WaitableTrait,
} from "../model";
import type { ApplicationProtocol } from "./ApplicationProtocol";
import { CodegenUtils } from "./CodegenUtils";
import { documentedShape } from "./documentation/ShapeDocs";
import { ServiceClosure } from "./knowledge/ServiceClosure";
import { PaginationGenerator } from "./PaginationGenerator";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { WaiterGenerator } from "./WaiterGenerator";

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const uncapitalize = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

/**
 * Generates the aggregated service client with one method per operation.
 */
export class ServiceAggregatedClientGenerator {
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _service: ServiceShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _writer: TypeScriptWriter;
  private readonly _aggregateClientName: string;
  private readonly _serviceSymbol: Symbol;
  private readonly _applicationProtocol: ApplicationProtocol;
  private readonly _closure: ServiceClosure;

  public constructor(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    aggregateClientName: string,
    writer: TypeScriptWriter,
    applicationProtocol: ApplicationProtocol
  ) {
    this._settings = settings;
    this._model = model;
    this._service = settings.getService(model);
    this._symbolProvider = symbolProvider;
    this._writer = writer;
    this._aggregateClientName = aggregateClientName;
    this._applicationProtocol = applicationProtocol;
    this._serviceSymbol = symbolProvider.toSymbol(this._service).toBuilder().putProperty("typeOnly", false).build();
    this._closure = ServiceClosure.of(model, this._service);
  }

  public run(): void {
    const writer = this._writer;
    const containedOperations = TopDownIndex.of(this._model).getContainedOperations(this._service);
    let hasPaginators = this._closure.getPaginatedOperationShapes().size > 0;
    let hasWaiters = this._closure.getWaitableOperationShapes().size > 0;

    writer.openBlock("const commands = {");
    for (const operation of containedOperations) {
      const operationSymbol = this._symbolProvider
        .toSymbol(operation)
        .toBuilder()
        .putProperty("typeOnly", false)
        .build();
      writer.write("$T,", operationSymbol);
      if (operation.hasTrait(PaginatedTrait)) {
        hasPaginators = true;
      }
      if (operation.hasTrait(WaitableTrait)) {
        hasWaiters = true;
      }
    }
    writer.closeBlock("};");

    if (hasPaginators) {
      writer.openBlock("const paginators = {");
      for (const operation of this._closure.getPaginatedOperationShapes()) {
        const paginatorFnName = "paginate" + operation.getId().getName();
        const paginatorLocalName = "paginate" + capitalize(operation.getId().getName());
        writer.addRelativeImport(
          paginatorFnName,
          paginatorLocalName,
          "./" +
            [
              CodegenUtils.SOURCE_FOLDER,
              PaginationGenerator.getOutputFileLocation(operation).replace(/(.*?)pagination(.*?)\.ts$/, "pagination$2"),
            ].join("/")
        );
        writer.write("$L,", paginatorLocalName);
      }
      writer.closeBlock("};");
    }

    if (hasWaiters) {
      writer.openBlock("const waiters = {");
      for (const operation of this._closure.getWaitableOperationShapes()) {
        for (const waiterName of operation.expectTrait(WaitableTrait).getWaiters().keys()) {
          const waiterFnName = "waitUntil" + waiterName;
          const waiterLocalName = "waitUntil" + capitalize(waiterName);
          writer.addRelativeImport(
            waiterFnName,
            waiterLocalName,
            "./" +
              [
                CodegenUtils.SOURCE_FOLDER,
                WaiterGenerator.getOutputFileLocation(waiterName).replace(/(.*?)waiters(.*?)\.ts$/, "waiters$2"),
              ].join("/")
          );
          writer.write("$L,", waiterLocalName);
        }
      }
      writer.closeBlock("};");
    }
    writer.write("");

    const requestOptionsType = this._aggregateClientName + "RequestOptions";
    writer.addTypeImport("MetricsRecorder", "__MetricsRecorder", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs("@public");
    writer.openBlock(
      "export interface $L extends $T {",
      "}",
      requestOptionsType,
      this._applicationProtocol.getOptionsType(),
      () => {
        writer.write("metricsRecorder?: __MetricsRecorder<unknown>;");
      }
    );
    writer.write("");

    writer.openBlock("export interface $L {", "}", this._aggregateClientName, () => {
      for (const operation of containedOperations) {
        this._writeOperationMethods(operation, requestOptionsType);
      }
      for (const operation of this._closure.getPaginatedOperationShapes()) {
        if (operation.hasTrait(PaginatedTrait)) {
          this._writePaginatorMethod(operation);
        }
      }
      for (const operation of this._closure.getWaitableOperationShapes()) {
        if (operation.hasTrait(WaitableTrait)) {
          this._writeWaiterMethods(operation);
        }
      }
      writer.unwrite("\n");
    });
    writer.write("");
    writer.writeShapeDocs(documentedShape(this._service));
    writer.write(
      "export class $L extends $T implements $L {}",
      this._aggregateClientName,
      this._serviceSymbol,
      this._aggregateClientName
    );
    writer.addImportSubmodule(
      "createAggregatedClient",
      null,
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.CLIENT
    );
    if (hasPaginators && hasWaiters) {
      writer.write("createAggregatedClient(commands, $L, { paginators, waiters });", this._aggregateClientName);
    } else if (hasPaginators) {
      writer.write("createAggregatedClient(commands, $L, { paginators });", this._aggregateClientName);
    } else if (hasWaiters) {
      writer.write("createAggregatedClient(commands, $L, { waiters });", this._aggregateClientName);
    } else {
      writer.write("createAggregatedClient(commands, $L);", this._aggregateClientName);
    }
  }

  private _isInputOptional(operation: OperationShape): boolean {
    const shape = this._model.getShape(operation.getInputShape());
    return shape === undefined ? true : [...shape.getAllMembers().values()].every((member) => !member.isRequired());
  }

  private _writeOperationMethods(operation: OperationShape, requestOptionsType: string): void {
    const writer = this._writer;
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const input = operationSymbol.expectProperty<Symbol>("inputType");
    const output = operationSymbol.expectProperty<Symbol>("outputType");
    writer.addUseImports(operationSymbol);
    const methodName = uncapitalize(operationSymbol.getName().replace(/Command$/, ""));
    writer.writeDocs("@see {@link " + operationSymbol.getName() + "}");
    if (this._isInputOptional(operation)) {
      writer.write("$L(): Promise<$T>;", methodName, output);
    }
    writer.write(
      "$1L(\n  args: $2T,\n  options?: $3L\n): Promise<$4T>;\n$1L(\n  args: $2T,\n  cb: (err: any, data?: $4T) => void\n): void;\n$1L(\n  args: $2T,\n  options: $3L,\n  cb: (err: any, data?: $4T) => void\n): void;",
      methodName,
      input,
      requestOptionsType,
      output
    );
    writer.write("");
  }

  private _writePaginatorMethod(operation: OperationShape): void {
    const writer = this._writer;
    const paginatorLocalName = "paginate" + capitalize(operation.getId().getName());
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const input = operationSymbol.expectProperty<Symbol>("inputType");
    const output = operationSymbol.expectProperty<Symbol>("outputType");
    writer.addTypeImport("Paginator", null, TypeScriptDependency.SMITHY_TYPES);
    writer.addTypeImport("PaginationConfiguration", null, TypeScriptDependency.SMITHY_TYPES);
    const inputOptionality = this._isInputOptional(operation) ? "?" : "";
    writer.writeDocs(
      `@see {@link ${operationSymbol.getName()}}\n@param args - command input.\n@param paginationConfig - optional pagination config.\n@returns AsyncIterable of {@link ${output.getName()}}.`
    );
    writer.write(
      '$1L(\n  args$5L: $2T,\n  paginationConfig?: Omit<$3L, "client">\n): Paginator<$4T>;\n',
      paginatorLocalName,
      input,
      "PaginationConfiguration",
      output,
      inputOptionality
    );
  }

  private _writeWaiterMethods(operation: OperationShape): void {
    const writer = this._writer;
    const waitableTrait = operation.expectTrait(WaitableTrait);
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const input = operationSymbol.expectProperty<Symbol>("inputType");
    const output = operationSymbol.expectProperty<Symbol>("outputType");
    const serviceName = CodegenUtils.getServiceName(this._settings, this._model, this._symbolProvider);
    const syntheticBaseExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, this._model);
    writer.addRelativeTypeImport(syntheticBaseExceptionName, null, "./src/models/" + syntheticBaseExceptionName);
    for (const [waiterName, waiter] of waitableTrait.getWaiters()) {
      const waiterLocalName = "waitUntil" + capitalize(waiterName);
      writer.addTypeImport("WaiterConfiguration", null, TypeScriptDependency.SMITHY_TYPES);
      writer.addTypeImportSubmodule(
        "WaiterResult",
        null,
        TypeScriptDependency.SMITHY_CORE,
        SmithyCoreSubmodules.CLIENT
      );
      const waitUntilResultType = WaiterGenerator.computeWaitUntilResultType(
        waiter,
        output.getName(),
        syntheticBaseExceptionName,
        this._settings,
        this._model,
        this._symbolProvider,
        writer
      );
      writer.writeDocs(
        `@see {@link ${operationSymbol.getName()}}\n@param args - command input.\n@param waiterConfig - \`maxWaitTime\` in seconds or waiter config object.`
      );
      writer.write(
        '$1L(\n  args: $2T,\n  waiterConfig: number | Omit<$3L, "client">\n): Promise<WaiterResult<$4L>>;\n',
        waiterLocalName,
        input,
        "WaiterConfiguration<" + this._aggregateClientName + ">",
        waitUntilResultType
      );
    }
  }
}
