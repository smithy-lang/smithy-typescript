import type { SymbolProvider } from "../codegen-core";
import { EnumTrait, type Model, type Shape, TopDownIndex } from "../model";
import { CodegenUtils } from "./CodegenUtils";
import { ServiceClosure } from "./knowledge/ServiceClosure";
import { SchemaGenerationAllowlist } from "./schema/SchemaGenerationAllowlist";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Generates the index and snapshot tests of a client package.
 */
export class PackageApiValidationGenerator {
  private readonly _writer: TypeScriptWriter;
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _closure: ServiceClosure;

  public constructor(
    writer: TypeScriptWriter,
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider
  ) {
    this._writer = writer;
    this._settings = settings;
    this._model = model;
    this._symbolProvider = symbolProvider;
    this._closure = ServiceClosure.of(model, settings.getService(model));
  }

  public writeTypeIndexTest(): void {
    const writer = this._writer;
    writer.openBlock("export type {", '} from "../dist-types/index.d";', () => {
      const aggregateClientName = CodegenUtils.getServiceName(this._settings, this._model, this._symbolProvider);
      writer.write("$L", aggregateClientName + "Client,");
      writer.write(aggregateClientName + ",");
      for (const operation of TopDownIndex.of(this._model).getContainedOperations(this._settings.getService())) {
        const commandName = this._symbolProvider.toSymbol(operation).getName();
        writer.write("$L,", commandName);
        writer.write("$LInput,", commandName);
        writer.write("$LOutput,", commandName);
      }
      for (const enumShape of this._closure.getEnums()) {
        writer.write("$L,", this._symbolProvider.toSymbol(enumShape).getName());
      }
      for (const structuralShape of this._closure.getStructuralNonErrorShapes()) {
        writer.write("$L,", this._symbolProvider.toSymbol(structuralShape).getName());
      }
      for (const errorShape of this._closure.getErrorShapes()) {
        writer.write("$L,", this._symbolProvider.toSymbol(errorShape).getName());
      }
      writer.write("$L,", CodegenUtils.getSyntheticBaseExceptionName(aggregateClientName, this._model));
      for (const waiter of this._closure.getWaiterNames()) {
        writer.write("$L,", waiter);
      }
      for (const paginator of this._closure.getPaginatorNames()) {
        writer.write("$L,", paginator);
      }
    });
  }

  public writeRuntimeIndexTest(): void {
    const writer = this._writer;
    const settings = this._settings;
    const schemaMode = SchemaGenerationAllowlist.allows(settings.getService(), settings);
    writer.write('import assert from "node:assert";');
    const cjsIndex = "./dist-cjs/index.js";
    const aggregateClientName = CodegenUtils.getServiceName(settings, this._model, this._symbolProvider);
    writer.addRelativeImport(aggregateClientName + "Client", null, cjsIndex);
    writer.addRelativeImport(aggregateClientName, null, cjsIndex);

    writer.write("// clients");
    writer.write('assert(typeof $L === "function");', aggregateClientName + "Client");
    writer.write('assert(typeof $L === "function");', aggregateClientName);

    writer.write("// commands");
    for (const operation of TopDownIndex.of(this._model).getContainedOperations(settings.getService())) {
      const operationSymbol = this._symbolProvider.toSymbol(operation);
      writer.addRelativeImport(operationSymbol.getName(), null, cjsIndex);
      writer.write('assert(typeof $L === "function");', operationSymbol.getName());
      if (schemaMode) {
        const schemaVarName = this._closure.getShapeSchemaVariableName(operation);
        writer.addRelativeImport(schemaVarName, null, cjsIndex);
        writer.write('assert(typeof $L === "object");', schemaVarName);
      }
    }

    writer.write("// structural schemas");
    for (const structuralShape of this._closure.getStructuralNonErrorShapes()) {
      if (schemaMode) {
        const schemaVarName = this._closure.getShapeSchemaVariableName(structuralShape);
        writer.addRelativeImport(schemaVarName, null, cjsIndex);
        writer.write('assert(typeof $L === "object");', schemaVarName);
      }
    }

    const enumShapes = [...this._closure.getEnums()].filter(
      (shape: Shape) => shape.getTrait(EnumTrait)?.hasNames() ?? true
    );
    if (enumShapes.length > 0) {
      writer.write("// enums");
    }
    for (const enumShape of enumShapes) {
      const enumSymbol = this._symbolProvider.toSymbol(enumShape);
      writer.addRelativeImport(enumSymbol.getName(), null, cjsIndex);
      writer.write('assert(typeof $L === "object");', enumSymbol.getName());
    }

    const baseExceptionName = CodegenUtils.getSyntheticBaseExceptionName(aggregateClientName, this._model);
    writer.write("// errors");
    for (const error of this._closure.getErrorShapes()) {
      const errorSymbol = this._symbolProvider.toSymbol(error);
      writer.addRelativeImport(errorSymbol.getName(), null, cjsIndex);
      writer.write("assert($L.prototype instanceof $L);", errorSymbol.getName(), baseExceptionName);
      if (schemaMode) {
        const schemaVarName = this._closure.getShapeSchemaVariableName(error);
        writer.addRelativeImport(schemaVarName, null, cjsIndex);
        writer.write('assert(typeof $L === "object");', schemaVarName);
      }
    }
    writer.addRelativeImport(baseExceptionName, null, cjsIndex);
    writer.write("assert($L.prototype instanceof Error);", baseExceptionName);

    const waiterNames = this._closure.getWaiterNames();
    if (waiterNames.size > 0) {
      writer.write("// waiters");
    }
    for (const waiter of waiterNames) {
      writer.addRelativeImport(waiter, null, cjsIndex);
      writer.write('assert(typeof $L === "function");', waiter);
    }

    const paginatorNames = this._closure.getPaginatorNames();
    if (paginatorNames.size > 0) {
      writer.write("// paginators");
    }
    for (const paginator of paginatorNames) {
      writer.addRelativeImport(paginator, null, cjsIndex);
      writer.write('assert(typeof $L === "function");', paginator);
    }
    writer.write("console.log(`$L index test passed.`);", aggregateClientName);
  }

  public writeSnapshotTest(): void {
    const writer = this._writer;
    const settings = this._settings;
    writer.addImport("SnapshotRunner", null, TypeScriptDependency.SNAPSHOTS);
    writer.addImport("describe", null, TypeScriptDependency.VITEST);
    writer.addImport("vi", null, TypeScriptDependency.VITEST);
    writer.addImport("test", "it", TypeScriptDependency.VITEST);
    writer.addImport("expect", null, TypeScriptDependency.VITEST);
    writer.addImport("join", null, "node:path");

    const aggregateClientName = CodegenUtils.getServiceName(settings, this._model, this._symbolProvider);
    const clientName = aggregateClientName + "Client";
    const srcIndex = "./" + CodegenUtils.SOURCE_FOLDER;
    writer.addRelativeImport(clientName, null, srcIndex);
    writer.write("vi.setSystemTime(new Date(946702799999));\nconst Client = $L;\n", clientName);
    writer.openBlock(
      'const mode = (process.env.SNAPSHOT_MODE as "write" | "compare") ?? "write";\n\ndescribe($S + ` ($${mode})`, () => {\n  const runner = new SnapshotRunner({\n    snapshotDirPath: join(__dirname, "snapshots"),\n    Client,\n    mode,\n    testCase(caseName: string, run: () => Promise<void>) {\n      it(caseName, run);\n    },\n    assertions(caseName: string, expected: string, actual: string): Promise<void> {\n      expect(actual).toEqual(expected);\n      return Promise.resolve();\n    },',
      "  });\n  runner.run();\n}, 30_000);\n",
      clientName,
      () => {
        writer.indent();
        writer.openBlock("schemas: new Map<any, any>([", "]),", () => {
          for (const operationShape of this._closure.getOperationShapes()) {
            const operationSchema = this._closure.getShapeSchemaVariableName(operationShape);
            writer.addRelativeImport(operationSchema, null, srcIndex);
            const commandName =
              capitalize(settings.getService(this._model).getContextualName(operationShape.getId())) + "Command";
            writer.addRelativeImport(commandName, null, srcIndex);
            writer.write("[$L, $L],", operationSchema, commandName);
          }
        });
        writer.openBlock("errors: [", "],", () => {
          for (const errorShape of this._closure.getErrorShapes()) {
            const schemaName = this._closure.getShapeSchemaVariableName(errorShape);
            writer.addRelativeImport(schemaName, null, srcIndex);
            writer.write("$L,", schemaName);
          }
        });
        writer.dedent();
      }
    );
  }
}
