import type { Symbol, SymbolProvider, SymbolReference } from "../codegen-core";
import { type Model, type OperationShape, type ServiceShape, TopDownIndex } from "../model";
import type { ApplicationProtocol } from "./ApplicationProtocol";
import { CodegenUtils } from "./CodegenUtils";
import { documentedShape } from "./documentation/ShapeDocs";
import { EndpointsV2Generator } from "./endpointsV2/EndpointsV2Generator";
import type { RuntimeClientPlugin } from "./integration/RuntimeClientPlugin";
import type { TypeScriptIntegration } from "./integration/TypeScriptIntegration";
import { SchemaGenerationAllowlist } from "./schema/SchemaGenerationAllowlist";
import { ClientBodyExtraCodeSection } from "./sections/ClientBodyExtraCodeSection";
import { ClientConfigCodeSection } from "./sections/ClientConfigCodeSection";
import { ClientConstructorCodeSection } from "./sections/ClientConstructorCodeSection";
import { ClientDestroyCodeSection } from "./sections/ClientDestroyCodeSection";
import { ClientPropertiesCodeSection } from "./sections/ClientPropertiesCodeSection";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";

const isSymbol = (value: unknown): value is Symbol =>
  typeof value === "object" && value !== null && "getNamespace" in value && "getName" in value;

/**
 * Generates the bare-bones service client class and its configuration types.
 */
export class ServiceBareBonesClientGenerator {
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _service: ServiceShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _writer: TypeScriptWriter;
  private readonly _symbol: Symbol;
  private readonly _configType: string;
  private readonly _resolvedConfigType: string;
  private readonly _integrations: TypeScriptIntegration[];
  private readonly _runtimePlugins: RuntimeClientPlugin[];
  private readonly _applicationProtocol: ApplicationProtocol;

  public constructor(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    writer: TypeScriptWriter,
    integrations: TypeScriptIntegration[],
    runtimePlugins: RuntimeClientPlugin[],
    applicationProtocol: ApplicationProtocol
  ) {
    this._settings = settings;
    this._model = model;
    this._service = settings.getService(model);
    this._symbolProvider = symbolProvider;
    this._writer = writer;
    this._integrations = integrations;
    this._runtimePlugins = runtimePlugins.filter((plugin) => plugin.matchesService(model, this._service));
    this._applicationProtocol = applicationProtocol;
    this._symbol = symbolProvider.toSymbol(this._service);
    this._configType = ServiceBareBonesClientGenerator.getConfigTypeName(this._symbol);
    this._resolvedConfigType = ServiceBareBonesClientGenerator.getResolvedConfigTypeName(this._symbol);
  }

  public static getConfigTypeName(symbol: Symbol): string {
    return symbol.getName() + "Config";
  }

  public static getResolvedConfigTypeName(symbol: Symbol): string {
    return symbol.getName() + "ResolvedConfig";
  }

  public run(): void {
    const writer = this._writer;
    writer.addImportSubmodule("Client", "__Client", TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
    writer.write("export { __Client };\n");
    writer.addRelativeImport("getRuntimeConfig", "__getRuntimeConfig", "./src/runtimeConfig");

    this._writeInputOutputTypeUnion(
      "ServiceInputTypes",
      (operationSymbol) => operationSymbol.getProperty<Symbol>("inputType"),
      (w) => {
        w.write("| {}");
      }
    );
    this._writeInputOutputTypeUnion(
      "ServiceOutputTypes",
      (operationSymbol) => operationSymbol.getProperty<Symbol>("outputType"),
      (w) => {
        w.addTypeImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
        w.write("| __MetadataBearer");
      }
    );
    this._generateConfig();
    writer.write("");
    this._generateService();
  }

  private _writeInputOutputTypeUnion(
    typeName: string,
    mapper: (symbol: Symbol) => Symbol | undefined,
    defaultTypeGenerator: (writer: TypeScriptWriter) => void
  ): void {
    const writer = this._writer;
    const containedOperations: readonly OperationShape[] = TopDownIndex.of(this._model).getContainedOperations(
      this._service
    );
    const symbols = containedOperations
      .map((operation) => this._symbolProvider.toSymbol(operation))
      .map(mapper)
      .filter((symbol): symbol is Symbol => symbol !== undefined)
      .sort((a, b) => (a.getName() < b.getName() ? -1 : a.getName() > b.getName() ? 1 : 0));
    writer.writeDocs("@public");
    writer.write("export type $L = ", typeName);
    writer.indent();
    if (containedOperations.length !== symbols.length || containedOperations.length === 0) {
      defaultTypeGenerator(writer);
    }
    symbols.forEach((symbol, i) => {
      writer.write("| $T$L", symbol, i === symbols.length - 1 ? ";" : "");
    });
    writer.dedent();
    writer.write("");
  }

  private _generateConfig(): void {
    const writer = this._writer;
    const symbol = this._symbol;
    writer.addRelativeTypeImport("RuntimeExtensionsConfig", null, "./src/runtimeExtensions");
    writer.addTypeImportSubmodule(
      "SmithyConfiguration",
      "__SmithyConfiguration",
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.CLIENT
    );
    writer.addTypeImportSubmodule(
      "SmithyResolvedConfiguration",
      "__SmithyResolvedConfiguration",
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.CLIENT
    );
    writer.pushState(
      ClientConfigCodeSection.builder()
        .settings(this._settings)
        .model(this._model)
        .service(this._service)
        .symbolProvider(this._symbolProvider)
        .integrations(this._integrations)
        .runtimeClientPlugins(this._runtimePlugins)
        .applicationProtocol(this._applicationProtocol)
        .build()
    );
    this._generateClientDefaults();
    writer.writeDocs("@public");
    writer.write(
      "export type $LType = Partial<__SmithyConfiguration<$T>> &",
      this._configType,
      this._applicationProtocol.getOptionsType()
    );
    writer.indent();
    writer.write("ClientDefaults &");
    const inputTypes: SymbolReference[] = this._runtimePlugins
      .map((p) => p.getInputConfig())
      .filter((ref): ref is SymbolReference => ref !== undefined);
    if (inputTypes.length > 0) {
      for (const symbolReference of inputTypes) {
        if (symbolReference.getAlias() === "EndpointInputConfig") {
          writer.addTypeImport("EndpointParameters", null, EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
          writer.write("$T<$L> &", symbolReference, "EndpointParameters");
        } else {
          writer.write("$T &", symbolReference);
        }
      }
      writer.addTypeImport("ClientInputEndpointParameters", null, EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
      writer.write("ClientInputEndpointParameters;");
      writer.dedent();
    }
    writer.writeDocs(
      `@public\n\n The configuration interface of ${symbol.getName()} class constructor that set the region, credentials and other options.`
    );
    writer.write("export interface $1L extends $1LType {}", this._configType);
    writer.write("");
    writer.writeDocs("@public");
    writer.write(
      "export type $LType = __SmithyResolvedConfiguration<$T> &",
      this._resolvedConfigType,
      this._applicationProtocol.getOptionsType()
    );
    writer.indent();
    writer.write("Required<ClientDefaults> &");
    writer.write("RuntimeExtensionsConfig &");
    if (inputTypes.length > 0) {
      for (const resolved of this._runtimePlugins
        .map((p) => p.getResolvedConfig())
        .filter((ref): ref is SymbolReference => ref !== undefined)) {
        if (resolved.getAlias() === "EndpointResolvedConfig") {
          writer.addTypeImport("EndpointParameters", null, EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
          writer.write("$T<$L> &", resolved, "EndpointParameters");
        } else {
          writer.write("$T &", resolved);
        }
      }
      writer.addTypeImport(
        "ClientResolvedEndpointParameters",
        null,
        EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY
      );
      writer.write("ClientResolvedEndpointParameters;");
      writer.dedent();
    }
    writer.writeDocs(
      `@public\n\n The resolved configuration interface of ${symbol.getName()} class. This is resolved and normalized from the {@link ${this._configType} | constructor configuration interface}.`
    );
    writer.write("export interface $1L extends $1LType {}", this._resolvedConfigType);
    writer.popState();
  }

  private _generateClientDefaults(): void {
    const writer = this._writer;
    if (!this._applicationProtocol.isHttpProtocol()) {
      throw new Error("Protocols other than HTTP are not yet implemented");
    }
    const innerContent = (): void => {
      writer.addTypeImportSubmodule(
        "HttpHandlerUserInput",
        "__HttpHandlerUserInput",
        TypeScriptDependency.SMITHY_CORE,
        SmithyCoreSubmodules.PROTOCOLS
      );
      writer.writeDocs("The HTTP handler to use or its constructor options. Fetch in browser and Https in Nodejs.");
      writer.write("requestHandler?: __HttpHandlerUserInput;\n");
      writer.addTypeImport("HashConstructor", "__HashConstructor", TypeScriptDependency.SMITHY_TYPES);
      writer.addTypeImport("ChecksumConstructor", "__ChecksumConstructor", TypeScriptDependency.SMITHY_TYPES);
      writer.writeDocs(
        "A constructor for a class implementing the {@link @smithy/types#ChecksumConstructor} interface\nthat computes the SHA-256 HMAC or checksum of a string or binary buffer.\n@internal"
      );
      writer.write("sha256?: __ChecksumConstructor | __HashConstructor;\n");
      writer.addTypeImport("UrlParser", "__UrlParser", TypeScriptDependency.SMITHY_TYPES);
      writer.writeDocs("The function that will be used to convert strings into HTTP endpoints.\n@internal");
      writer.write("urlParser?: __UrlParser;\n");
      writer.addTypeImport("BodyLengthCalculator", "__BodyLengthCalculator", TypeScriptDependency.SMITHY_TYPES);
      writer.writeDocs("A function that can calculate the length of a request body.\n@internal");
      writer.write("bodyLengthChecker?: __BodyLengthCalculator;\n");
      writer.addTypeImport("StreamCollector", "__StreamCollector", TypeScriptDependency.SMITHY_TYPES);
      writer.writeDocs("A function that converts a stream into an array of bytes.\n@internal");
      writer.write("streamCollector?: __StreamCollector;\n");
      writer.addTypeImport("Encoder", "__Encoder", TypeScriptDependency.SMITHY_TYPES);
      writer.addTypeImport("Decoder", "__Decoder", TypeScriptDependency.SMITHY_TYPES);
      writer.writeDocs("The function that will be used to convert a base64-encoded string to a byte array.\n@internal");
      writer.write("base64Decoder?: __Decoder;\n");
      writer.writeDocs("The function that will be used to convert binary data to a base64-encoded string.\n@internal");
      writer.write("base64Encoder?: __Encoder;\n");
      writer.writeDocs("The function that will be used to convert a UTF8-encoded string to a byte array.\n@internal");
      writer.write("utf8Decoder?: __Decoder;\n");
      writer.writeDocs("The function that will be used to convert binary data to a UTF-8 encoded string.\n@internal");
      writer.write("utf8Encoder?: __Encoder;\n");
      writer.writeDocs("The runtime environment.\n@internal");
      writer.write("runtime?: string;\n");
      writer.writeDocs(
        "Disable dynamically changing the endpoint of the client based on the hostPrefix \ntrait of an operation."
      );
      writer.write("disableHostPrefix?: boolean;\n");
      for (const integration of this._integrations) {
        integration.addConfigInterfaceFields(this._settings, this._model, this._symbolProvider, writer);
      }
    };
    writer
      .writeDocs("@public")
      .openBlock(
        "export interface ClientDefaults extends Partial<__SmithyConfiguration<$T>> {",
        "}\n",
        this._applicationProtocol.getOptionsType(),
        innerContent
      );
  }

  private _bodySection() {
    return ClientBodyExtraCodeSection.builder()
      .settings(this._settings)
      .model(this._model)
      .service(this._service)
      .symbolProvider(this._symbolProvider)
      .integrations(this._integrations)
      .runtimeClientPlugins(this._runtimePlugins)
      .applicationProtocol(this._applicationProtocol)
      .build();
  }

  private _generateService(): void {
    const writer = this._writer;
    writer.writeShapeDocs(documentedShape(this._service));
    writer.openBlock(
      "export class $L extends __Client<\n  $T,\n  ServiceInputTypes,\n  ServiceOutputTypes,\n  $L\n> {",
      "}",
      this._symbol.getName(),
      this._applicationProtocol.getOptionsType(),
      this._resolvedConfigType,
      () => {
        this._generateClientProperties();
        this._generateConstructor();
        writer.write("");
        this._generateDestroyMethod();
        writer.injectSection(this._bodySection());
      }
    );
  }

  private _generateClientProperties(): void {
    const writer = this._writer;
    writer.pushState(
      ClientPropertiesCodeSection.builder()
        .settings(this._settings)
        .model(this._model)
        .service(this._service)
        .symbolProvider(this._symbolProvider)
        .integrations(this._integrations)
        .applicationProtocol(this._applicationProtocol)
        .build()
    );
    writer.writeDocs(
      `The resolved configuration of ${this._symbol.getName()} class. This is resolved and normalized from the {@link ${this._configType} | constructor configuration interface}.`
    );
    writer.write("readonly config: $L;\n", this._resolvedConfigType);
    writer.popState();
  }

  private _generateConstructor(): void {
    const writer = this._writer;
    const service = this._service;
    const model = this._model;
    const configVar = ServiceBareBonesClientGenerator._configVariable;
    writer.addTypeImport("CheckOptionalClientConfig", "__CheckOptionalClientConfig", TypeScriptDependency.SMITHY_TYPES);
    writer.openBlock(
      "constructor(...[configuration]: __CheckOptionalClientConfig<$L>) {",
      "}",
      this._configType,
      () => {
        writer.pushState(
          ClientConstructorCodeSection.builder()
            .service(service)
            .runtimeClientPlugins(this._runtimePlugins)
            .model(model)
            .build()
        );
        let configVariable = 0;
        const initialConfigVar = configVar(configVariable);
        writer.write("const $L = __getRuntimeConfig(configuration || {});", initialConfigVar);
        writer.write("super($L as any);", initialConfigVar);
        writer.write("this.initConfig = $L;", initialConfigVar);
        configVariable++;
        writer.addImport("resolveClientEndpointParameters", null, EndpointsV2Generator.ENDPOINT_PARAMETERS_DEPENDENCY);
        writer.write(
          "const $L = $L($L);",
          configVar(configVariable),
          "resolveClientEndpointParameters",
          configVar(configVariable - 1)
        );

        for (const plugin of this._runtimePlugins) {
          const resolveFunction = plugin.getResolveFunction();
          if (resolveFunction === undefined) {
            continue;
          }
          configVariable++;
          const paramsMap = plugin.getAdditionalResolveFunctionParameters(
            model,
            service,
            null as unknown as OperationShape
          );
          const additionalParameters = CodegenUtils.getFunctionParametersList(paramsMap);
          const additionalParamsString =
            additionalParameters.length === 0 ? "" : `, { ${additionalParameters.join(", ")} }`;
          writer.pushState();
          writer.putContext("newConfig", configVar(configVariable));
          writer.putContext("resolveFn", resolveFunction);
          writer.putContext("oldConfig", configVar(configVariable - 1));
          for (const [key, value] of paramsMap) {
            if (isSymbol(value)) {
              writer.putContext(key, value);
            }
          }
          writer.write("const $newConfig:L = $resolveFn:T($oldConfig:L" + additionalParamsString + ");");
          writer.popState();
        }
        writer.addRelativeImport("resolveRuntimeExtensions", null, "./src/runtimeExtensions");
        configVariable++;
        writer.write(
          "const $L = resolveRuntimeExtensions($L, configuration?.extensions || []);",
          configVar(configVariable),
          configVar(configVariable - 1)
        );
        writer.write("this.config = $L;", configVar(configVariable));

        if (SchemaGenerationAllowlist.allows(service.getId(), this._settings)) {
          writer.addImportSubmodule("getSchemaSerdePlugin", null, TypeScriptDependency.SMITHY_CORE, "/schema");
          writer.write("this.middlewareStack.use(getSchemaSerdePlugin(this.config));");
        }

        for (const plugin of this._runtimePlugins) {
          this._writePluginUse(plugin);
        }
        writer.popState();
      }
    );
  }

  private _writePluginUse(plugin: RuntimeClientPlugin): void {
    const writer = this._writer;
    const pluginSymbol = plugin.getPluginFunction();
    if (pluginSymbol === undefined) {
      return;
    }
    const paramsMap = plugin.getAdditionalPluginFunctionParameters(
      this._model,
      this._service,
      null as unknown as OperationShape
    );
    writer.pushState();
    writer.putContext("pluginFn", pluginSymbol);
    for (const [key, value] of paramsMap) {
      if (isSymbol(value)) {
        writer.putContext(key, value);
      }
    }
    const isAuthSchemeEndpointRuleSetPlugin = pluginSymbol.getAlias() === "getHttpAuthSchemeEndpointRuleSetPlugin";
    if (isAuthSchemeEndpointRuleSetPlugin) {
      writer.openBlock("this.middlewareStack.use(");
      writer.ensureNewline();
      writer.writeInline("$pluginFn:T(this.config");
    } else {
      writer.writeInline("this.middlewareStack.use($pluginFn:T(this.config");
    }
    const additionalParameters = CodegenUtils.getFunctionParametersList(paramsMap);
    const clientAddParamsWriterConsumers = plugin.getClientAddParamsWriterConsumers();
    if (additionalParameters.length > 0 || clientAddParamsWriterConsumers.size > 0) {
      writer.writeInline(", ");
      writer.write("{").indent();
      if (additionalParameters.length > 0) {
        writer.writeInline(additionalParameters.join(", ") + ", ");
      }
      for (const [key, consumer] of clientAddParamsWriterConsumers) {
        writer.write("$L: $C,", key, (w2: TypeScriptWriter) => consumer(w2, this._bodySection()));
      }
      writer.dedent();
      writer.writeInline("}");
    }
    if (isAuthSchemeEndpointRuleSetPlugin) {
      writer.write(")");
      writer.closeBlock(");");
    } else {
      writer.write("));");
    }
    writer.popState();
  }

  private static _configVariable(n: number): string {
    return "_config_" + n;
  }

  private _generateDestroyMethod(): void {
    const writer = this._writer;
    if (this._applicationProtocol.isHttpProtocol()) {
      writer.writeDocs(
        "Destroy underlying resources, like sockets. It's usually not necessary to do this.\nHowever in Node.js, it's best to explicitly shut down the client's agent when it is no longer needed.\nOtherwise, sockets might stay open for quite a long time before the server terminates them."
      );
    }
    writer.openBlock("destroy(): void {", "}", () => {
      writer.pushState(ClientDestroyCodeSection.builder().runtimeClientPlugins(this._runtimePlugins).build());
      for (const plugin of this._runtimePlugins) {
        const destroy = plugin.getDestroyFunction();
        if (destroy !== undefined) {
          writer.write("$T(this.config);", destroy);
        }
      }
      writer.popState();
      writer.write("super.destroy();");
    });
  }
}
