import type { FileManifest, Symbol, SymbolProvider } from "../codegen-core";
import {
  DeprecatedTrait,
  DocumentationTrait,
  ErrorTrait,
  ExamplesTrait,
  InternalTrait,
  type Model,
  OperationIndex,
  type OperationShape,
  type ServiceShape,
  type StructureShape,
  StreamingTrait,
  TopDownIndex,
  TreeMap,
} from "../model";
import type { ApplicationProtocol } from "./ApplicationProtocol";
import type { CommandBuilderGenerator } from "./CommandBuilderGenerator";
import { CodegenUtils } from "./CodegenUtils";
import { documentedShape } from "./documentation/ShapeDocs";
import { DocumentationExampleGenerator } from "./documentation/DocumentationExampleGenerator";
import { StructureExampleGenerator } from "./documentation/StructureExampleGenerator";
import type { ProtocolGenerator } from "./integration/ProtocolGenerator";
import type { RuntimeClientPlugin } from "./integration/RuntimeClientPlugin";
import { ServiceClosure } from "./knowledge/ServiceClosure";
import { SchemaGenerationAllowlist } from "./schema/SchemaGenerationAllowlist";
import { PreCommandClassCodeSection } from "./sections/PreCommandClassCodeSection";
import { ServiceBareBonesClientGenerator } from "./ServiceBareBonesClientGenerator";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { TypeScriptWriter } from "./TypeScriptWriter";
import { PropertyAccessor } from "./util";

const COMMANDS_FOLDER = "commands";
const SCHEMAS_FOLDER = "schemas";

/**
 * Generates a command class for an operation.
 */
export class CommandGenerator {
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _service: ServiceShape;
  private readonly _operation: OperationShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _writer: TypeScriptWriter;
  private readonly _symbol: Symbol;
  private readonly _runtimePlugins: RuntimeClientPlugin[];
  private readonly _operationIndex: OperationIndex;
  private readonly _inputType: Symbol;
  private readonly _outputType: Symbol;
  private readonly _protocolGenerator: ProtocolGenerator | undefined;
  private readonly _applicationProtocol: ApplicationProtocol;
  private readonly _closure: ServiceClosure;
  private readonly _commandBuilderGenerator: CommandBuilderGenerator | undefined;

  public constructor(
    settings: TypeScriptSettings,
    model: Model,
    operation: OperationShape,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter,
    runtimePlugins: RuntimePluginList,
    protocolGenerator: ProtocolGenerator | undefined,
    applicationProtocol: ApplicationProtocol,
    commandBuilderGenerator?: CommandBuilderGenerator
  ) {
    this._settings = settings;
    this._model = model;
    this._service = settings.getService(model);
    this._operation = operation;
    this._symbolProvider = symbolProvider;
    this._writer = writer;
    this._runtimePlugins = runtimePlugins.filter((plugin) => plugin.matchesOperation(model, this._service, operation));
    this._protocolGenerator = protocolGenerator;
    this._applicationProtocol = applicationProtocol;
    this._commandBuilderGenerator = commandBuilderGenerator;
    this._closure = ServiceClosure.of(model, this._service);
    this._symbol = symbolProvider.toSymbol(operation);
    this._operationIndex = OperationIndex.of(model);
    this._inputType = this._symbol.expectProperty<Symbol>("inputType");
    this._outputType = this._symbol.expectProperty<Symbol>("outputType");
  }

  public static writeIndex(
    model: Model,
    service: ServiceShape,
    symbolProvider: SymbolProvider,
    fileManifest: FileManifest
  ): void {
    const writer = new TypeScriptWriter("");
    const byName = new TreeMap<string, OperationShape>();
    for (const operation of TopDownIndex.of(model).getContainedOperations(service)) {
      byName.set(symbolProvider.toSymbol(operation).getName(), operation);
    }
    const names = [...byName.keys()];
    if (names.length === 0) {
      writer.write("export {};");
    } else {
      for (const name of names) {
        writer.write('export * from "./$L";', name);
      }
    }
    fileManifest.writeFile([CodegenUtils.SOURCE_FOLDER, COMMANDS_FOLDER, "index.ts"].join("/"), writer.toString());
  }

  public run(): void {
    this._addInputAndOutputTypes();
    if (
      this._commandBuilderGenerator !== undefined &&
      SchemaGenerationAllowlist.allows(this._service.getId(), this._settings)
    ) {
      this._generateClientCommandWithBuilder();
    } else {
      throw new Error("Non-schema command generation is not ported");
    }
  }

  private _addInputAndOutputTypes(): void {
    const writer = this._writer;
    writer.writeDocs("@public");
    writer.write("export type { __MetadataBearer };");
    this._writeInputType(
      this._inputType.getName(),
      this._operationIndex.getInput(this._operation),
      this._symbol.getName()
    );
    this._writeOutputType(
      this._outputType.getName(),
      this._operationIndex.getOutput(this._operation),
      this._symbol.getName()
    );
    writer.write("");
  }

  private _writeInputType(typeName: string, inputShape: StructureShape | undefined, commandName: string): void {
    const writer = this._writer;
    if (inputShape === undefined) {
      writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
      writer.write("export interface $L {}", typeName);
      return;
    }
    const blobStreamingMembers = CodegenUtils.getBlobStreamingMembers(this._model, inputShape);
    const blobPayloadMembers = CodegenUtils.getBlobPayloadMembers(this._model, inputShape);
    if (blobStreamingMembers.length > 0) {
      CodegenUtils.writeClientCommandStreamingInputType(
        writer,
        this._symbolProvider.toSymbol(inputShape),
        typeName,
        blobStreamingMembers[0],
        commandName
      );
    } else if (blobPayloadMembers.length > 0) {
      CodegenUtils.writeClientCommandBlobPayloadInputType(
        writer,
        this._symbolProvider.toSymbol(inputShape),
        typeName,
        blobPayloadMembers[0],
        commandName
      );
    } else {
      writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
      const inputSymbol = this._symbolProvider.toSymbol(inputShape);
      writer.addRelativeTypeImport(inputSymbol.getName(), null, inputSymbol.getNamespace());
      writer.write("export interface $L extends $L {}", typeName, inputSymbol.getName());
    }
  }

  private _writeOutputType(typeName: string, outputShape: StructureShape | undefined, commandName: string): void {
    const writer = this._writer;
    writer.addTypeImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
    if (outputShape === undefined) {
      writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
      writer.write("export interface $L extends __MetadataBearer {}", typeName);
      return;
    }
    const blobStreamingMembers = CodegenUtils.getBlobStreamingMembers(this._model, outputShape);
    const blobPayloadMembers = CodegenUtils.getBlobPayloadMembers(this._model, outputShape);
    if (blobStreamingMembers.length > 0) {
      CodegenUtils.writeClientCommandStreamingOutputType(
        writer,
        this._symbolProvider.toSymbol(outputShape),
        typeName,
        blobStreamingMembers[0],
        commandName
      );
    } else if (blobPayloadMembers.length > 0) {
      CodegenUtils.writeClientCommandBlobPayloadOutputType(
        writer,
        this._symbolProvider.toSymbol(outputShape),
        typeName,
        blobPayloadMembers[0],
        commandName
      );
    } else {
      writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
      const outputSymbol = this._symbolProvider.toSymbol(outputShape);
      writer.addRelativeTypeImport(outputSymbol.getName(), null, outputSymbol.getNamespace());
      writer.write("export interface $L extends $L, __MetadataBearer {}", typeName, outputSymbol.getName());
    }
  }

  private _generateClientCommandWithBuilder(): void {
    const writer = this._writer;
    const operation = this._operation;
    const builder = this._commandBuilderGenerator!;
    const serviceSymbol = this._symbolProvider.toSymbol(this._service);
    const configType = ServiceBareBonesClientGenerator.getResolvedConfigTypeName(serviceSymbol);
    const epVar = builder.getEndpointParamVar(operation)!;
    const mwVar = builder.getMiddlewareVar(operation)!;
    writer.addRelativeImport("command", null, "./src/commandBuilder");
    writer.addRelativeImport(epVar, null, "./src/commandBuilder");
    writer.addRelativeImport(mwVar, null, "./src/commandBuilder");
    const operationSchema = this._closure.getShapeSchemaVariableName(operation);
    writer.addRelativeImport(
      operationSchema,
      null,
      "./" + [CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER, "schemas_0"].join("/")
    );

    const name = this._symbol.getName();
    const operationShapeName = operation.toShapeId().getName();
    const additionalDocs =
      "\n" +
      this._getCommandExample(
        serviceSymbol.getName(),
        configType,
        name,
        this._inputType.getName(),
        this._outputType.getName()
      ) +
      "\n" +
      this._getThrownExceptions() +
      "\n" +
      this._getCuratedExamples(name);

    if (operation.hasTrait(DocumentationTrait)) {
      writer.writeShapeDocs(documentedShape(operation), (shapeDoc) => shapeDoc + additionalDocs);
    } else {
      const isPublic = !operation.hasTrait(InternalTrait);
      let deprecatedTag = "";
      const deprecated = operation.getTrait(DeprecatedTrait);
      if (deprecated !== undefined) {
        deprecatedTag = TypeScriptWriter.buildDeprecationAnnotation(deprecated) + "\n";
      }
      writer.writeDocs((isPublic ? "@public\n" : "@internal\n") + deprecatedTag + additionalDocs);
    }
    writer.injectSection(
      PreCommandClassCodeSection.builder()
        .settings(this._settings)
        .model(this._model)
        .service(this._service)
        .operation(operation)
        .symbolProvider(this._symbolProvider)
        .runtimeClientPlugins(this._runtimePlugins)
        .protocolGenerator(this._protocolGenerator as never)
        .applicationProtocol(this._applicationProtocol)
        .build()
    );

    writer.pushState().putContext("inputType", this._inputType).putContext("outputType", this._outputType);
    writer.openBlock(
      "export class $L extends command<$inputType:T, $outputType:T>(\n  $L,\n  $L,\n  $S,\n  $L\n) {",
      "}",
      name,
      epVar,
      mwVar,
      operationShapeName,
      operationSchema,
      () => {
        const operationInputShape = this._model.expectShape(operation.getInputShape());
        const baseInput = this._symbolProvider.toSymbol(operationInputShape);
        const operationOutputShape = this._model.expectShape(operation.getOutputShape());
        const baseOutput = this._symbolProvider.toSymbol(operationOutputShape);
        if (operationInputShape.getAllMembers().size > 0) {
          writer.addRelativeTypeImport(baseInput.getName(), null, baseInput.getNamespace());
        }
        if (operationOutputShape.getAllMembers().size > 0) {
          writer.addRelativeTypeImport(baseOutput.getName(), null, baseOutput.getNamespace());
        }
        const baseInputStr = operationInputShape.getAllMembers().size === 0 ? "{}" : baseInput.getName();
        const baseOutputStr = operationOutputShape.getAllMembers().size === 0 ? "{}" : baseOutput.getName();
        writer.write("/** @internal type navigation helper, not in runtime. */");
        writer.openBlock("protected declare static __types: {", "};", () => {
          writer.write("api: {\n  input: $L;\n  output: $L;\n};", baseInputStr, baseOutputStr);
          writer.write("sdk: {\n  input: $T;\n  output: $T;\n};", this._inputType, this._outputType);
        });
      }
    );
    writer.popState();
  }

  private _getCommandExample(
    serviceName: string,
    configName: string,
    commandName: string,
    commandInput: string,
    commandOutput: string
  ): string {
    const packageName = this._settings.getPackageName();
    return (
      "@example\n" +
      "Use a bare-bones client and the command you need to make an API call.\n" +
      "```javascript\n" +
      `import { ${serviceName}, ${commandName} } from "${packageName}"; // ES Modules import\n` +
      `// const { ${serviceName}, ${commandName} } = require("${packageName}"); // CommonJS import\n` +
      `// import type { ${serviceName}Config } from "${packageName}";\n` +
      `const config = {}; // type is ${serviceName}Config\n` +
      `const client = new ${serviceName}(config);\n` +
      `const input = ${StructureExampleGenerator.generateStructuralHintDocumentation(
        this._model.getShape(this._operation.getInputShape())!,
        this._model,
        false,
        true
      )}\n` +
      `const command = new ${commandName}(input);\n` +
      "const response = await client.send(command);" +
      this._getStreamingBlobOutputAddendum() +
      "\n" +
      `${StructureExampleGenerator.generateStructuralHintDocumentation(
        this._model.getShape(this._operation.getOutputShape())!,
        this._model,
        true,
        false
      )}\n` +
      "\n```\n" +
      "\n" +
      `@param ${commandInput} - {@link ${commandInput}}\n` +
      `@returns {@link ${commandOutput}}\n` +
      `@see {@link ${commandInput}} for command's \`input\` shape.\n` +
      `@see {@link ${commandOutput}} for command's \`response\` shape.\n` +
      `@see {@link ${configName} | config} for ${serviceName}'s \`config\` shape.\n`
    );
  }

  private _getCuratedExamples(commandName: string): string {
    const trait = this._operation.getTrait(ExamplesTrait);
    if (trait === undefined) {
      return "";
    }
    let buffer = "";
    for (const example of trait.getExamples()) {
      buffer +=
        "\n" +
        `@example ${example.getTitle()}\n` +
        "```javascript\n" +
        `// ${example.getDocumentation() ?? ""}\n` +
        `const input = ${DocumentationExampleGenerator.inputToJavaScriptObject(example.getInput() as never)};\n` +
        `const command = new ${commandName}(input);\n` +
        `const response = await client.send(command);${this._getStreamingBlobOutputAddendum()}\n` +
        "/* response is\n" +
        `${DocumentationExampleGenerator.outputToJavaScriptObject(example.getOutput() as never)}\n` +
        "*/\n" +
        "```" +
        "\n";
    }
    return buffer;
  }

  private _getStreamingBlobOutputMember(): string {
    const member = [...this._model.expectShape(this._operation.getOutputShape()).getAllMembers().values()].find((m) => {
      const target = this._model.expectShape(m.getTarget());
      return target.isBlobShape() && (target.hasTrait(StreamingTrait) || m.hasTrait(StreamingTrait));
    });
    return member?.getMemberName() ?? "";
  }

  private _getStreamingBlobOutputAddendum(): string {
    const memberName = this._getStreamingBlobOutputMember();
    if (memberName === "") {
      return "";
    }
    const propAccess = PropertyAccessor.getFrom("response", memberName);
    return (
      "\n// consume or destroy the stream to free the socket.\n" +
      `const bytes = await ${propAccess}.transformToByteArray();\n` +
      `// const str = await ${propAccess}.transformToString();\n` +
      `// ${propAccess}.destroy(); // only applicable to Node.js Readable streams.\n`
    );
  }

  private _getThrownExceptions(): string {
    let buffer = "";
    for (const error of this._operation.getErrors()) {
      const errorShape = this._model.getShape(error)!;
      const doc = errorShape.getTrait(DocumentationTrait);
      const errorTrait = errorShape.getTrait(ErrorTrait)!;
      if (doc !== undefined) {
        buffer += `@throws {@link ${error.getName()}} (${errorTrait.getValue()} fault)\n ${doc.getValue()}`;
      } else {
        buffer += `@throws {@link ${error.getName()}} (${errorTrait.getValue()} fault)`;
      }
      buffer += "\n\n";
    }
    const name = CodegenUtils.getServiceName(this._settings, this._model, this._symbolProvider);
    buffer += `@throws {@link ${CodegenUtils.getSyntheticBaseExceptionName(name, this._model)}}\n`;
    buffer += `<p>Base exception class for all service exceptions from ${name} service.</p>\n`;
    return buffer;
  }
}

type RuntimePluginList = RuntimeClientPlugin[];
