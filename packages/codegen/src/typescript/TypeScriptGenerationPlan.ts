import type { EnumShape, IntEnumShape, ServiceShape, Shape, StringShape, StructureShape, UnionShape } from "../model";
import { CodegenUtils } from "./CodegenUtils";
import { HttpAuthSchemeProviderGenerator } from "./auth/http/HttpAuthSchemeProviderGenerator";
import { ExtensionConfigurationGenerator } from "./ExtensionConfigurationGenerator";
import { RuntimeExtensionsGenerator } from "./RuntimeExtensionsGenerator";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { PackageApiValidationGenerator } from "./PackageApiValidationGenerator";
import { LanguageTarget } from "./LanguageTarget";
import { RuntimeConfigGenerator } from "./RuntimeConfigGenerator";
import { CommandBuilderGenerator } from "./CommandBuilderGenerator";
import { CommandGenerator } from "./CommandGenerator";
import { EndpointsV2Generator } from "./endpointsV2/EndpointsV2Generator";
import { GenerationContext } from "./integration/ProtocolGenerator";
import { PaginationGenerator } from "./PaginationGenerator";
import { ServiceAggregatedClientGenerator } from "./ServiceAggregatedClientGenerator";
import { WaiterGenerator } from "./WaiterGenerator";
import { replaceLast } from "./validation/ReplaceLast";
import { PaginatedTrait, TopDownIndex, WaitableTrait } from "../model";
import { ServiceBareBonesClientGenerator } from "./ServiceBareBonesClientGenerator";
import { IndexGenerator } from "./IndexGenerator";
import { SymbolVisitor } from "./SymbolVisitor";
import type { GenerationPlan } from "./DirectedTypeScriptCodegen";
import { EnumGenerator } from "./EnumGenerator";
import { IntEnumGenerator } from "./IntEnumGenerator";
import { SchemaGenerationAllowlist } from "./schema/SchemaGenerationAllowlist";
import { SchemaGenerator } from "./schema/SchemaGenerator";
import { StructureGenerator } from "./StructureGenerator";
import type { TypeScriptCodegenContext } from "./TypeScriptCodegenContext";
import { UnionGenerator } from "./UnionGenerator";

const TSCONFIG_TEST = `{
  "extends": "./tsconfig.types.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": ".",
    "declaration": false,
    "emitDeclarationOnly": false,
    "declarationDir": null
  },
  "include": ["test/index-types.ts"]
}
`;

/**
 * Wires the shape and service generators into the directed flow.
 */
export class TypeScriptGenerationPlan implements GenerationPlan {
  public generateStructure(context: TypeScriptCodegenContext, shape: StructureShape): void {
    const settings = context.settings();
    context.writerDelegator().useShapeWriter(shape, (writer) => {
      const schemaMode = TypeScriptGenerationPlan._allowsSchemaGeneration(context);
      const includeValidation = settings.generateServerSdk() && !schemaMode;
      new StructureGenerator(
        context.model(),
        context.symbolProvider(),
        writer,
        shape,
        includeValidation,
        settings.getRequiredMemberMode(),
        schemaMode
      ).run();
    });
  }

  public generateError(context: TypeScriptCodegenContext, shape: StructureShape): void {
    const settings = context.settings();
    context.writerDelegator().useShapeWriter(shape, (writer) => {
      new StructureGenerator(
        context.model(),
        context.symbolProvider(),
        writer,
        shape,
        settings.generateServerSdk(),
        settings.getRequiredMemberMode(),
        TypeScriptGenerationPlan._allowsSchemaGeneration(context)
      ).run();
    });
  }

  public generateUnion(context: TypeScriptCodegenContext, shape: UnionShape): void {
    const settings = context.settings();
    context.writerDelegator().useShapeWriter(shape, (writer) => {
      const schemaMode = TypeScriptGenerationPlan._allowsSchemaGeneration(context);
      const includeValidation = settings.generateServerSdk() && !schemaMode;
      new UnionGenerator(context.model(), context.symbolProvider(), writer, shape, includeValidation, schemaMode).run();
    });
  }

  public generateEnum(context: TypeScriptCodegenContext, shape: StringShape | EnumShape): void {
    context.writerDelegator().useShapeWriter(shape, (writer) => {
      new EnumGenerator(shape, context.symbolProvider().toSymbol(shape), writer).run();
    });
  }

  public generateIntEnum(context: TypeScriptCodegenContext, shape: IntEnumShape): void {
    context.writerDelegator().useShapeWriter(shape, (writer) => {
      new IntEnumGenerator(shape, context.symbolProvider().toSymbol(shape), writer).run();
    });
  }

  public generateService(context: TypeScriptCodegenContext, _service: ServiceShape): void {
    const settings = context.settings();
    if (settings.generateClient()) {
      context
        .writerDelegator()
        .useShapeWriter(_service, (writer) =>
          new ServiceBareBonesClientGenerator(
            settings,
            context.model(),
            context.symbolProvider(),
            writer,
            context.integrations(),
            context.runtimePlugins(),
            context.applicationProtocol()
          ).run()
        );
      if (!settings.useLegacyAuth()) {
        new HttpAuthSchemeProviderGenerator(
          context.writerDelegator(),
          settings,
          context.model(),
          context.symbolProvider(),
          context.integrations()
        ).run();
      }
      new EndpointsV2Generator(context.writerDelegator(), settings, context.model()).run();
      this._generateCommands(context, _service);
      this._generateAggregatedClient(context, _service);
      new SchemaGenerator(context.model(), context.fileManifest(), settings, context.symbolProvider()).run();
    }
  }

  public customizeBeforeIntegrations(context: TypeScriptCodegenContext, _service: ServiceShape, shapes: Shape[]): void {
    const settings = context.settings();
    const delegator = context.writerDelegator();
    if (settings.generateClient()) {
      const configGenerator = new RuntimeConfigGenerator(
        settings,
        context.model(),
        context.symbolProvider(),
        delegator,
        context.integrations(),
        context.applicationProtocol()
      );
      for (const target of LanguageTarget.values()) {
        configGenerator.generate(target);
      }
      const service = settings.getService(context.model());
      new ExtensionConfigurationGenerator(
        context.model(),
        settings,
        service,
        context.symbolProvider(),
        delegator,
        context.integrations()
      ).generate();
      new RuntimeExtensionsGenerator(
        context.model(),
        settings,
        service,
        context.symbolProvider(),
        delegator,
        context.integrations()
      ).generate();
    }
    const modelIndexer = SymbolVisitor.modelIndexer(shapes, context.symbolProvider());
    delegator.useFileWriter([CodegenUtils.SOURCE_FOLDER, "index.ts"].join("/"), (writer) => {
      IndexGenerator.writeIndex(
        settings,
        context.model(),
        context.symbolProvider(),
        context.protocolGenerator(),
        writer,
        modelIndexer
      );
    });
    const validation = (writer: TypeScriptWriter): PackageApiValidationGenerator =>
      new PackageApiValidationGenerator(writer, settings, context.model(), context.symbolProvider());
    if (settings.generateClient() && settings.generateIndexTests()) {
      delegator.useFileWriter([CodegenUtils.TEST_FOLDER, "index-types.ts"].join("/"), (writer) => {
        validation(writer).writeTypeIndexTest();
      });
      delegator.useFileWriter([CodegenUtils.TEST_FOLDER, "index-objects.spec.mjs"].join("/"), (writer) => {
        validation(writer).writeRuntimeIndexTest();
      });
      context.fileManifest().writeFile("tsconfig.test.json", TSCONFIG_TEST);
    }
    if (
      settings.generateClient() &&
      settings.generateSnapshotTests() &&
      TypeScriptGenerationPlan._allowsSchemaGeneration(context)
    ) {
      delegator.useFileWriter([CodegenUtils.TEST_FOLDER, "snapshots.integ.spec.ts"].join("/"), (writer) => {
        validation(writer).writeSnapshotTest();
      });
    }
    const protocolGenerator = context.protocolGenerator();
    const skipProtocolTests = settings.generateServerSdk() && TypeScriptGenerationPlan._allowsSchemaGeneration(context);
    if (protocolGenerator !== undefined && !skipProtocolTests) {
      const generationContext = new GenerationContext();
      generationContext.setProtocolName(protocolGenerator.getName());
      generationContext.setModel(context.model());
      generationContext.setService(_service);
      generationContext.setSettings(settings);
      generationContext.setSymbolProvider(context.symbolProvider());
      generationContext.setWriterDelegator(delegator);
      protocolGenerator.generateProtocolTests(generationContext);
    }
  }

  private _generateCommands(context: TypeScriptCodegenContext, service: ServiceShape): void {
    const settings = context.settings();
    const model = context.model();
    const symbolProvider = context.symbolProvider();
    const delegator = context.writerDelegator();
    CommandGenerator.writeIndex(model, service, symbolProvider, context.fileManifest());
    let commandBuilderGenerator: CommandBuilderGenerator | undefined;
    if (SchemaGenerationAllowlist.allows(service.getId(), settings)) {
      commandBuilderGenerator = new CommandBuilderGenerator(settings, model, symbolProvider, context.runtimePlugins());
      commandBuilderGenerator.collectOperations();
      commandBuilderGenerator.generate(delegator);
    }
    for (const operation of TopDownIndex.of(model).getContainedOperations(service)) {
      delegator.useShapeWriter(operation, (writer) =>
        new CommandGenerator(
          settings,
          model,
          operation,
          symbolProvider,
          writer,
          context.runtimePlugins(),
          context.protocolGenerator(),
          context.applicationProtocol(),
          commandBuilderGenerator
        ).run()
      );
    }
  }

  private _generateAggregatedClient(context: TypeScriptCodegenContext, service: ServiceShape): void {
    const settings = context.settings();
    const model = context.model();
    const symbolProvider = context.symbolProvider();
    const delegator = context.writerDelegator();
    const serviceSymbol = symbolProvider.toSymbol(service);
    const aggregatedClientName = replaceLast(serviceSymbol.getName(), "Client", "");
    const filename = replaceLast(serviceSymbol.getDefinitionFile(), "Client", "");
    delegator.useFileWriter(filename, (writer) =>
      new ServiceAggregatedClientGenerator(
        settings,
        model,
        symbolProvider,
        aggregatedClientName,
        writer,
        context.applicationProtocol()
      ).run()
    );
    const operations = TopDownIndex.of(model).getContainedOperations(service);
    for (const operation of operations) {
      if (operation.hasTrait(PaginatedTrait)) {
        delegator.useFileWriter(PaginationGenerator.getOutputFileLocation(operation), (writer) =>
          new PaginationGenerator(model, service, operation, symbolProvider, writer, aggregatedClientName).run()
        );
      }
      const waitable = operation.getTrait(WaitableTrait);
      if (waitable !== undefined) {
        for (const [waiterName, waiter] of waitable.getWaiters()) {
          delegator.useFileWriter(WaiterGenerator.getOutputFileLocation(waiterName), (writer) =>
            new WaiterGenerator(waiterName, waiter, service, operation, writer, symbolProvider, settings, model).run()
          );
        }
      }
    }
    if (operations.some((operation) => operation.hasTrait(PaginatedTrait))) {
      PaginationGenerator.writeIndex(model, service, context.fileManifest());
      delegator.useFileWriter(PaginationGenerator.PAGINATION_INTERFACE_FILE, (writer) =>
        PaginationGenerator.generateServicePaginationInterfaces(aggregatedClientName, serviceSymbol, writer)
      );
    }
    if (operations.some((operation) => operation.hasTrait(WaitableTrait))) {
      WaiterGenerator.writeIndex(model, service, context.fileManifest());
    }
  }

  private static _allowsSchemaGeneration(context: TypeScriptCodegenContext): boolean {
    const settings = context.settings();
    return SchemaGenerationAllowlist.allows(settings.getOptionalService(), settings);
  }
}
