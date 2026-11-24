import { CodegenException, type FileManifest, type Symbol, type SymbolProvider } from "../codegen-core";
import {
  type Acceptor,
  type AcceptorState,
  ErrorTypeMember,
  InputOutputMember,
  type Model,
  type OperationShape,
  OutputMember,
  type ServiceShape,
  ShapeId,
  SuccessMember,
  TopDownIndex,
  WaitableTrait,
  type Waiter,
  TreeSet,
} from "../model";
import { CodegenUtils } from "./CodegenUtils";
import { ServiceClosure } from "./knowledge/ServiceClosure";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { TypeScriptWriter } from "./TypeScriptWriter";

const WAITERS_FOLDER = "waiters";
const WAITER_SUBMODULE = SmithyCoreSubmodules.CLIENT;

/**
 * Generates waiter functions for waitable operations.
 */
export class WaiterGenerator {
  private readonly _waiterName: string;
  private readonly _waiter: Waiter;
  private readonly _writer: TypeScriptWriter;
  private readonly _serviceSymbol: Symbol;
  private readonly _operationSymbol: Symbol;
  private readonly _inputSymbol: Symbol;
  private readonly _outputSymbol: Symbol;
  private readonly _waiterResultType: string;
  private readonly _waitUntilResultType: string;

  public constructor(
    waiterName: string,
    waiter: Waiter,
    service: ServiceShape,
    operation: OperationShape,
    writer: TypeScriptWriter,
    symbolProvider: SymbolProvider,
    settings: TypeScriptSettings,
    model: Model
  ) {
    this._waiterName = waiterName;
    this._waiter = waiter;
    this._writer = writer;
    this._operationSymbol = symbolProvider.toSymbol(operation);
    this._serviceSymbol = symbolProvider.toSymbol(service).toBuilder().putProperty("typeOnly", true).build();
    this._inputSymbol = this._operationSymbol.expectProperty<Symbol>("inputType");
    this._outputSymbol = this._operationSymbol.expectProperty<Symbol>("outputType");
    const serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
    const syntheticBaseExceptionName = CodegenUtils.getSyntheticBaseExceptionName(serviceName, model);
    writer.addRelativeTypeImport(syntheticBaseExceptionName, null, "./src/models/" + syntheticBaseExceptionName);
    this._waiterResultType = this._outputSymbol.getName() + " | " + syntheticBaseExceptionName;
    this._waitUntilResultType = WaiterGenerator.computeWaitUntilResultType(
      waiter,
      this._outputSymbol.getName(),
      syntheticBaseExceptionName,
      settings,
      model,
      symbolProvider,
      writer
    );
  }

  public static getOutputFileLocation(waiterName: string): string {
    return [CodegenUtils.SOURCE_FOLDER, WAITERS_FOLDER, "waitFor" + waiterName + ".ts"].join("/");
  }

  public static computeWaitUntilResultType(
    waiter: Waiter,
    outputTypeName: string,
    exceptionTypeName: string,
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): string {
    let waiterSuccessTerminalOnSuccessfulResponse = false;
    let waiterSuccessTerminalOnErrorResponse = false;
    const successErrorTypeNames = new TreeSet<string>();
    for (const acceptor of waiter.getAcceptors()) {
      if (acceptor.getState() !== "success") {
        continue;
      }
      const matcher = acceptor.getMatcher();
      if (matcher instanceof SuccessMember) {
        if (matcher.getValue()) {
          waiterSuccessTerminalOnSuccessfulResponse = true;
        } else {
          waiterSuccessTerminalOnErrorResponse = true;
        }
      } else if (matcher instanceof ErrorTypeMember) {
        waiterSuccessTerminalOnErrorResponse = true;
        successErrorTypeNames.add(matcher.getValue());
      } else if (matcher instanceof OutputMember || matcher instanceof InputOutputMember) {
        waiterSuccessTerminalOnSuccessfulResponse = true;
      }
    }

    let resolvedExceptionType = exceptionTypeName;
    if (successErrorTypeNames.size === 1) {
      const errorName = [...successErrorTypeNames][0];
      const errorTypeQualifiedName = errorName.includes("#");
      const errorShape = [...ServiceClosure.of(model, settings.getService(model)).getErrorShapes()].find((shape) =>
        errorTypeQualifiedName ? ShapeId.from(errorName).equals(shape.getId()) : shape.getId().getName() === errorName
      );
      if (errorShape !== undefined) {
        const typeName = symbolProvider.toSymbol(errorShape).getName();
        writer.addRelativeTypeImport(typeName, null, "./src/models/errors");
        resolvedExceptionType = typeName;
      }
    }
    if (waiterSuccessTerminalOnSuccessfulResponse && waiterSuccessTerminalOnErrorResponse) {
      return outputTypeName + " | " + resolvedExceptionType;
    }
    if (waiterSuccessTerminalOnErrorResponse) {
      return resolvedExceptionType;
    }
    return outputTypeName;
  }

  public static writeIndex(model: Model, service: ServiceShape, fileManifest: FileManifest): void {
    const writer = new TypeScriptWriter("");
    const containedOperations = TopDownIndex.of(model).getContainedOperations(service);
    for (const operation of containedOperations) {
      const waitableTrait = operation.getTrait(WaitableTrait);
      if (waitableTrait !== undefined) {
        for (const waiterName of waitableTrait.getWaiters().keys()) {
          writer.write(
            'export * from "./$L";',
            WaiterGenerator._getModulePath(WaiterGenerator.getOutputFileLocation(waiterName))
          );
        }
      }
    }
    fileManifest.writeFile([CodegenUtils.SOURCE_FOLDER, WAITERS_FOLDER, "index.ts"].join("/"), writer.toString());
  }

  public run(): void {
    this._writer.addDependency(TypeScriptDependency.SMITHY_CORE);
    this._generateAcceptors();
    this._generateWaiter();
  }

  private static _getModulePath(fileLocation: string): string {
    return fileLocation.substring(fileLocation.lastIndexOf("/") + 1).replace(".ts", "");
  }

  private _generateWaiter(): void {
    const writer = this._writer;
    const waiter = this._waiter;
    const waiterName = this._waiterName;
    writer.addImportSubmodule("createWaiter", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
    writer.addTypeImportSubmodule("WaiterResult", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
    writer.addImportSubmodule("WaiterState", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
    writer.addImportSubmodule("checkExceptions", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);
    writer.addTypeImportSubmodule("WaiterConfiguration", null, TypeScriptDependency.SMITHY_CORE, WAITER_SUBMODULE);

    writer.writeDocs(
      (waiter.getDocumentation() ?? "") +
        " \n" +
        " @deprecated Use waitUntil" +
        waiterName +
        " instead. waitFor" +
        waiterName +
        " does not throw error in non-success cases."
    );
    writer.openBlock(
      "export const waitFor$L = async (\n  params: WaiterConfiguration<$T>,\n  input: $T\n): Promise<WaiterResult<$L>> => {",
      "};",
      waiterName,
      this._serviceSymbol,
      this._inputSymbol,
      this._waiterResultType,
      () => {
        writer.write(
          "const serviceDefaults = { minDelay: $L, maxDelay: $L };",
          waiter.getMinDelay(),
          waiter.getMaxDelay()
        );
        writer.write("return createWaiter({ ...serviceDefaults, ...params }, input, checkState);");
      }
    );

    writer.writeDocs(
      (waiter.getDocumentation() ?? "") +
        " \n" +
        " @param params - Waiter configuration options.\n" +
        " @param input - The input to " +
        this._operationSymbol.getName() +
        " for polling."
    );
    writer.openBlock(
      "export const waitUntil$L = async (\n  params: WaiterConfiguration<$T>,\n  input: $T\n): Promise<WaiterResult<$L>> => {",
      "};",
      waiterName,
      this._serviceSymbol,
      this._inputSymbol,
      this._waitUntilResultType,
      () => {
        writer.write(
          "const serviceDefaults = { minDelay: $L, maxDelay: $L };",
          waiter.getMinDelay(),
          waiter.getMaxDelay()
        );
        writer.write("const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);");
        writer.write("return checkExceptions(result) as WaiterResult<$L>;", this._waitUntilResultType);
      }
    );
  }

  private _generateAcceptors(): void {
    const writer = this._writer;
    writer.openBlock(
      "const checkState = async (client: $T, input: $T): Promise<WaiterResult<$L>> => {",
      "};",
      this._serviceSymbol,
      this._inputSymbol,
      this._waiterResultType,
      () => {
        writer.write("let reason;");
        writer.write("try {").indent();
        writer.write(
          "let result: $T & any = await client.send(new $T(input));",
          this._outputSymbol,
          this._operationSymbol
        );
        writer.write("reason = result;");
        this._writeAcceptors("result", false);
        writer.dedent().write("} catch (exception) {").indent();
        writer.write("reason = exception;");
        this._writeAcceptors("exception", true);
        writer.dedent().write("}");
        writer.write("return $L;", WaiterGenerator._makeWaiterResult("retry"));
      }
    );
  }

  private _writeAcceptors(accessor: string, isException: boolean): void {
    this._waiter.getAcceptors().forEach((acceptor: Acceptor) => {
      const matcher = acceptor.getMatcher();
      if (matcher instanceof SuccessMember) {
        if (matcher.getValue() !== isException) {
          this._writer.write("return $L;", WaiterGenerator._makeWaiterResult(acceptor.getState()));
        }
      } else if (matcher instanceof ErrorTypeMember) {
        if (isException) {
          this._writer.openBlock("if ($L.name === $S) {", "}", accessor, matcher.getValue(), () => {
            this._writer.write("return $L;", WaiterGenerator._makeWaiterResult(acceptor.getState()));
          });
        }
      } else if (matcher instanceof InputOutputMember || matcher instanceof OutputMember) {
        if (!isException) {
          throw new CodegenException("JMESPath waiter path matchers are not ported");
        }
      } else {
        throw new CodegenException("Unknown matcher member name: " + matcher.getMemberName());
      }
    });
  }

  private static _makeWaiterResult(state: AcceptorState): string {
    switch (state) {
      case "success":
        return "{ state: WaiterState.SUCCESS, reason }";
      case "failure":
        return "{ state: WaiterState.FAILURE, reason }";
      case "retry":
        return "{ state: WaiterState.RETRY, reason }";
      default:
        throw new CodegenException("Hit an invalid acceptor state to codegen " + state);
    }
  }
}
