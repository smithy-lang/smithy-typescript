import type { Symbol, SymbolProvider } from "../../../codegen-core";
import { type Model, ServiceIndex, type ServiceShape, ShapeId, TopDownIndex } from "../../../model";
import { CodegenUtils } from "../../CodegenUtils";
import type { TypeScriptIntegration } from "../../integration/TypeScriptIntegration";
import { SmithyCoreSubmodules } from "../../SmithyCoreSubmodules";
import type { TypeScriptDelegator } from "../../TypeScriptDelegator";
import { TypeScriptDependency } from "../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../TypeScriptSettings";
import { TypeScriptWriter } from "../../TypeScriptWriter";
import type { JavaHashMap } from "../../util";
import { AuthUtils } from "../AuthUtils";
import type { HttpAuthScheme } from "./HttpAuthScheme";
import type { HttpAuthSchemeParameter } from "./HttpAuthSchemeParameter";
import {
  DefaultHttpAuthSchemeParametersProviderFunctionCodeSection,
  DefaultHttpAuthSchemeProviderFunctionCodeSection,
  HttpAuthOptionFunctionCodeSection,
  HttpAuthOptionFunctionsCodeSection,
  HttpAuthSchemeParametersInterfaceCodeSection,
  HttpAuthSchemeParametersProviderInterfaceCodeSection,
  HttpAuthSchemeProviderInterfaceCodeSection,
} from "./sections";
import { SupportedHttpAuthSchemesIndex } from "./SupportedHttpAuthSchemesIndex";

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Generates the HttpAuthSchemeProvider module of a client.
 */
export class HttpAuthSchemeProviderGenerator {
  private readonly _delegator: TypeScriptDelegator;
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _serviceIndex: ServiceIndex;
  private readonly _topDownIndex: TopDownIndex;
  private readonly _serviceShape: ServiceShape;
  private readonly _serviceSymbol: Symbol;
  private readonly _serviceName: string;
  private readonly _effectiveHttpAuthSchemes: Map<string, HttpAuthScheme | undefined>;
  private readonly _httpAuthSchemeParameters: JavaHashMap<HttpAuthSchemeParameter>;

  public constructor(
    delegator: TypeScriptDelegator,
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    integrations: TypeScriptIntegration[]
  ) {
    this._delegator = delegator;
    this._settings = settings;
    this._model = model;
    this._symbolProvider = symbolProvider;
    const authIndex = new SupportedHttpAuthSchemesIndex(integrations, model, settings);
    this._serviceIndex = ServiceIndex.of(model);
    this._topDownIndex = TopDownIndex.of(model);
    this._serviceShape = settings.getService(model);
    this._serviceSymbol = symbolProvider.toSymbol(this._serviceShape);
    this._serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
    this._effectiveHttpAuthSchemes = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(
      this._serviceShape,
      this._serviceIndex,
      authIndex,
      this._topDownIndex
    );
    this._httpAuthSchemeParameters = AuthUtils.collectHttpAuthSchemeParameters(this._effectiveHttpAuthSchemes.values());
  }

  public static normalizeAuthSchemeName(shapeId: ShapeId): string {
    return shapeId.toString().split(/[.#]/).map(capitalize).join("");
  }

  public run(): void {
    this._generateHttpAuthSchemeParametersInterface();
    this._generateHttpAuthSchemeParametersProviderInterface();
    this._generateDefaultHttpAuthSchemeParametersProviderFunction();
    this._generateHttpAuthOptionFunctions();
    this._generateHttpAuthSchemeProviderInterface();
    this._generateDefaultHttpAuthSchemeProviderFunction();
  }

  private _commonSection<T extends { builder(): any }>(section: T): ReturnType<T["builder"]> {
    return section
      .builder()
      .service(this._serviceShape)
      .settings(this._settings)
      .model(this._model)
      .symbolProvider(this._symbolProvider);
  }

  private _generateHttpAuthSchemeParametersInterface(): void {
    this._delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      w.pushState(
        this._commonSection(HttpAuthSchemeParametersInterfaceCodeSection)
          .httpAuthSchemeParameters(this._httpAuthSchemeParameters)
          .build()
      );
      w.addTypeImport("HttpAuthSchemeParameters", null, TypeScriptDependency.SMITHY_TYPES);
      w.openCollapsibleBlock(
        "/**\n * @internal\n */\nexport interface $LHttpAuthSchemeParameters extends HttpAuthSchemeParameters {",
        "}",
        this._httpAuthSchemeParameters.size > 0,
        this._serviceName,
        () => {
          for (const parameter of this._httpAuthSchemeParameters.values()) {
            w.write("$L?: $C;", parameter.name, parameter.type);
          }
        }
      );
      w.popState();
    });
  }

  private _generateHttpAuthSchemeParametersProviderInterface(): void {
    this._delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      w.pushState(this._commonSection(HttpAuthSchemeParametersProviderInterfaceCodeSection).build());
      w.addRelativeTypeImport(
        this._serviceSymbol.getName() + "ResolvedConfig",
        null,
        "./" + this._serviceSymbol.getNamespace()
      );
      w.addTypeImport("HttpAuthSchemeParametersProvider", null, TypeScriptDependency.SMITHY_TYPES);
      w.addTypeImport("HandlerExecutionContext", null, TypeScriptDependency.SMITHY_TYPES);
      w.write(
        "/**\n * @internal\n */\nexport interface $LHttpAuthSchemeParametersProvider\n  extends HttpAuthSchemeParametersProvider<\n    $LResolvedConfig,\n    HandlerExecutionContext,\n    $LHttpAuthSchemeParameters,\n    object\n  > {}",
        this._serviceName,
        this._serviceSymbol.getName(),
        this._serviceName
      );
      w.popState();
    });
  }

  private _generateDefaultHttpAuthSchemeParametersProviderFunction(): void {
    this._delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      w.pushState(
        this._commonSection(DefaultHttpAuthSchemeParametersProviderFunctionCodeSection)
          .httpAuthSchemeParameters(this._httpAuthSchemeParameters)
          .build()
      );
      w.addRelativeTypeImport(
        this._serviceSymbol.getName() + "ResolvedConfig",
        null,
        "./" + this._serviceSymbol.getNamespace()
      );
      w.addTypeImport("HandlerExecutionContext", null, TypeScriptDependency.SMITHY_TYPES);
      w.addDependency(TypeScriptDependency.SMITHY_CORE);
      w.addImportSubmodule("getSmithyContext", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
      w.openBlock(
        "/**\n * @internal\n */\nexport const default$LHttpAuthSchemeParametersProvider = async (\n  config: $LResolvedConfig,\n  context: HandlerExecutionContext,\n  input: object\n): Promise<$LHttpAuthSchemeParameters> => {",
        "};",
        this._serviceName,
        this._serviceSymbol.getName(),
        this._serviceName,
        () => {
          w.openBlock("return {", "};", () => {
            w.write("operation: getSmithyContext(context).operation as string,");
            for (const parameter of this._httpAuthSchemeParameters.values()) {
              w.write("$L: $C,", parameter.name, parameter.source);
            }
          });
        }
      );
      w.popState();
    });
  }

  private _generateHttpAuthOptionFunctions(): void {
    this._delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      w.pushState(
        this._commonSection(HttpAuthOptionFunctionsCodeSection)
          .effectiveHttpAuthSchemes(this._effectiveHttpAuthSchemes)
          .build()
      );
      for (const [schemeId, httpAuthScheme] of this._effectiveHttpAuthSchemes) {
        this._generateHttpAuthOptionFunction(
          w,
          this._commonSection(HttpAuthOptionFunctionCodeSection)
            .effectiveHttpAuthSchemes(this._effectiveHttpAuthSchemes)
            .schemeId(ShapeId.from(schemeId))
            .httpAuthScheme(httpAuthScheme ?? null)
            .build()
        );
      }
      w.popState();
    });
  }

  private _generateHttpAuthOptionFunction(
    w: TypeScriptWriter,
    s: InstanceType<typeof HttpAuthOptionFunctionCodeSection>
  ): void {
    w.pushState(s);
    const schemeId = s.props.schemeId as ShapeId;
    const normalizedAuthSchemeName = HttpAuthSchemeProviderGenerator.normalizeAuthSchemeName(schemeId);
    const authScheme = (s.props.httpAuthScheme as HttpAuthScheme | null) ?? undefined;
    w.addTypeImport("HttpAuthOption", null, TypeScriptDependency.SMITHY_TYPES);
    w.openBlock(
      "function create$LHttpAuthOption(authParameters: $LHttpAuthSchemeParameters): HttpAuthOption {",
      "}\n",
      normalizedAuthSchemeName,
      this._serviceName,
      () => {
        w.openBlock("return {", "};", () => {
          w.write("schemeId: $S,", schemeId.toString());
          if (authScheme === undefined) {
            return;
          }
          const trait = this._serviceShape.findTrait(authScheme.getTraitId());
          const identityProperties = authScheme.getHttpAuthSchemeOptionParametersByType("IDENTITY");
          if (identityProperties.length > 0) {
            w.openBlock("identityProperties: {", "},", () => {
              for (const parameter of identityProperties) {
                w.write("$L: $C,", parameter.name, parameter.source({ httpAuthScheme: authScheme, trait: trait! }));
              }
            });
          }
          const signingProperties = authScheme.getHttpAuthSchemeOptionParametersByType("SIGNING");
          if (signingProperties.length > 0) {
            w.openBlock("signingProperties: {", "},", () => {
              for (const parameter of signingProperties) {
                w.write("$L: $C,", parameter.name, parameter.source({ httpAuthScheme: authScheme, trait: trait! }));
              }
            });
          }
          const extractor = authScheme.getPropertiesExtractor();
          if (extractor !== undefined) {
            w.write(
              "propertiesExtractor: $C",
              extractor(
                this._serviceSymbol
                  .toBuilder()
                  .name(this._serviceSymbol.getName() + "Config")
                  .build()
              )
            );
          }
        });
      }
    );
    w.popState();
  }

  private _generateHttpAuthSchemeProviderInterface(): void {
    this._delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      w.pushState(this._commonSection(HttpAuthSchemeProviderInterfaceCodeSection).build());
      w.addTypeImport("HttpAuthSchemeProvider", null, TypeScriptDependency.SMITHY_TYPES);
      w.writeDocs("@internal");
      const candidate =
        `export interface ${this._serviceName}HttpAuthSchemeProvider extends` +
        ` HttpAuthSchemeProvider<${this._serviceName}HttpAuthSchemeParameters> {}`;
      if (candidate.length <= TypeScriptWriter.LINE_WIDTH) {
        w.write(candidate);
      } else {
        w.write(
          "export interface $LHttpAuthSchemeProvider\n  extends HttpAuthSchemeProvider<$LHttpAuthSchemeParameters> {}\n",
          this._serviceName,
          this._serviceName
        );
      }
      w.popState();
    });
  }

  private _generateDefaultHttpAuthSchemeProviderFunction(): void {
    this._delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      w.pushState(this._commonSection(DefaultHttpAuthSchemeProviderFunctionCodeSection).build());
      w.openBlock(
        "/**\n * @internal\n */\nexport const default$LHttpAuthSchemeProvider: $LHttpAuthSchemeProvider = (authParameters) => {",
        "};",
        this._serviceName,
        this._serviceName,
        () => {
          w.write("const options: HttpAuthOption[] = [];");
          w.openBlock("switch (authParameters.operation) {", "}", () => {
            const serviceAuthSchemes = this._serviceIndex.getEffectiveAuthSchemes(this._serviceShape, "NO_AUTH_AWARE");
            for (const operationShape of this._topDownIndex.getContainedOperations(this._serviceShape)) {
              const operationShapeId = operationShape.getId();
              const operationAuthSchemes = this._serviceIndex.getEffectiveAuthSchemes(
                this._serviceShape,
                operationShapeId,
                "NO_AUTH_AWARE"
              );
              if (AuthUtils.areHttpAuthSchemesEqual(serviceAuthSchemes, operationAuthSchemes)) {
                continue;
              }
              w.openBlock("case $S: {", "};", operationShapeId.getName(), () => {
                for (const shapeId of operationAuthSchemes.keys()) {
                  w.write(
                    "options.push(create$LHttpAuthOption(authParameters));",
                    HttpAuthSchemeProviderGenerator.normalizeAuthSchemeName(shapeId)
                  );
                }
                w.write("break;");
              });
            }
            w.openBlock("default: {", "}", () => {
              for (const shapeId of serviceAuthSchemes.keys()) {
                w.write(
                  "options.push(create$LHttpAuthOption(authParameters));",
                  HttpAuthSchemeProviderGenerator.normalizeAuthSchemeName(shapeId)
                );
              }
            });
          });
          w.write("return options;");
        }
      );
      w.popState();
    });
  }
}
