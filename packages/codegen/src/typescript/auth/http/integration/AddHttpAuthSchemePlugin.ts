import { Symbol } from "../../../../codegen-core";
import { ServiceIndex, TopDownIndex } from "../../../../model";
import { CodegenUtils } from "../../../CodegenUtils";
import { RuntimeClientPlugin } from "../../../integration/RuntimeClientPlugin";
import { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import { SmithyCoreSubmodules } from "../../../SmithyCoreSubmodules";
import type { ClientBodyExtraCodeSection } from "../../../sections/ClientBodyExtraCodeSection";
import type { TypeScriptCodegenContext } from "../../../TypeScriptCodegenContext";
import { TypeScriptDependency } from "../../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";
import type { TypeScriptWriter } from "../../../TypeScriptWriter";
import type { ClientWriterConsumer } from "../../../util";
import { AuthUtils } from "../../AuthUtils";
import type { HttpAuthScheme } from "../HttpAuthScheme";
import {
  HttpAuthSchemeInputConfigInterfaceCodeSection,
  HttpAuthSchemeResolvedConfigInterfaceCodeSection,
  ResolveHttpAuthSchemeConfigFunctionCodeSection,
  ResolveHttpAuthSchemeConfigFunctionConfigFieldsCodeSection,
  ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection,
} from "../sections";
import { SupportedHttpAuthSchemesIndex } from "../SupportedHttpAuthSchemesIndex";
import type { ConfigField } from "../ConfigField";
import type { ResolveConfigFunction } from "../ResolveConfigFunction";
import type { JavaHashMap } from "../../../util";
import type { HttpAuthTypeScriptIntegration } from "./HttpAuthTypeScriptIntegration";

/**
 * Generates the HttpAuthScheme config resolution and registers the related client plugins.
 */
export class AddHttpAuthSchemePlugin extends TypeScriptIntegration implements HttpAuthTypeScriptIntegration {
  public matchesSettings(settings: TypeScriptSettings): boolean {
    return !settings.useLegacyAuth();
  }

  public getHttpAuthScheme(): undefined {
    return undefined;
  }

  public customizeSupportedHttpAuthSchemes(): void {}

  public getClientPlugins(): RuntimeClientPlugin[] {
    const params = new Map<string, ClientWriterConsumer>([
      ["httpAuthSchemeParametersProvider", AddHttpAuthSchemePlugin._httpAuthSchemeParametersProvider],
      ["identityProviderConfigProvider", AddHttpAuthSchemePlugin._identityProviderConfigProvider],
    ]);
    const authSymbol = (name: string, typeOnly: boolean): Symbol => {
      const builder = Symbol.builder().namespace(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE, "/").name(name);
      if (typeOnly) {
        builder.putProperty("typeOnly", true);
      }
      return builder.build();
    };
    return [
      RuntimeClientPlugin.builder()
        .withConventions(TypeScriptDependency.SMITHY_CORE.dependency, "HttpAuthSchemeEndpointRuleSet", "HAS_MIDDLEWARE")
        .withAdditionalClientParams(params)
        .build(),
      RuntimeClientPlugin.builder()
        .inputConfig(authSymbol("HttpAuthSchemeInputConfig", true))
        .resolvedConfig(authSymbol("HttpAuthSchemeResolvedConfig", true))
        .resolveFunction(authSymbol("resolveHttpAuthSchemeConfig", false))
        .build(),
    ];
  }

  public customize(codegenContext: TypeScriptCodegenContext): void {
    const settings = codegenContext.settings();
    if (
      !settings.generateClient() ||
      settings.useLegacyAuth() ||
      !codegenContext.applicationProtocol().isHttpProtocol()
    ) {
      return;
    }
    codegenContext.writerDelegator().useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_PATH, (w) => {
      const model = codegenContext.model();
      const authIndex = new SupportedHttpAuthSchemesIndex(codegenContext.integrations(), model, settings);
      const serviceShape = settings.getService(model);
      const httpAuthSchemes = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(
        serviceShape,
        ServiceIndex.of(model),
        authIndex,
        TopDownIndex.of(model)
      );
      const configFields = AuthUtils.collectConfigFields(httpAuthSchemes.values());
      const resolveConfigFunctions = AuthUtils.collectResolveConfigFunctions(httpAuthSchemes.values());
      const build = (section: { builder(): any }) =>
        section
          .builder()
          .service(serviceShape)
          .settings(settings)
          .model(model)
          .symbolProvider(codegenContext.symbolProvider())
          .integrations(codegenContext.integrations())
          .configFields(configFields)
          .resolveConfigFunctions(resolveConfigFunctions)
          .build();
      this._generateHttpAuthSchemeInputConfigInterface(w, build(HttpAuthSchemeInputConfigInterfaceCodeSection));
      this._generateHttpAuthSchemeResolvedConfigInterface(w, build(HttpAuthSchemeResolvedConfigInterfaceCodeSection));
      this._generateResolveHttpAuthSchemeConfigFunction(w, build(ResolveHttpAuthSchemeConfigFunctionCodeSection));
    });
  }

  private static _httpAuthSchemeParametersProvider(w: TypeScriptWriter, section: ClientBodyExtraCodeSection): void {
    const name =
      "default" +
      CodegenUtils.getServiceName(section.getSettings(), section.getModel(), section.getSymbolProvider()) +
      "HttpAuthSchemeParametersProvider";
    w.addImport(name, null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
    w.writeInline(name);
  }

  private static _identityProviderConfigProvider(w: TypeScriptWriter, s: ClientBodyExtraCodeSection): void {
    w.addDependency(TypeScriptDependency.SMITHY_CORE);
    w.addImport("DefaultIdentityProviderConfig", null, TypeScriptDependency.SMITHY_CORE);
    const authIndex = new SupportedHttpAuthSchemesIndex(s.getIntegrations(), s.getModel(), s.getSettings());
    const httpAuthSchemes = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(
      s.getService(),
      ServiceIndex.of(s.getModel()),
      authIndex,
      TopDownIndex.of(s.getModel())
    );
    w.openBlock("async (config: $LResolvedConfig) =>", s.getSymbolProvider().toSymbol(s.getService()).getName());
    const schemes = [...httpAuthSchemes.values()].filter((scheme): scheme is HttpAuthScheme => scheme !== undefined);
    w.openCollapsibleBlock(
      "new DefaultIdentityProviderConfig({",
      "})",
      schemes.some((scheme) => scheme.getConfigFields().some((field) => field.type === "MAIN")),
      () => {
        for (const scheme of schemes) {
          for (const configField of scheme.getConfigFields()) {
            if (configField.type === "MAIN") {
              w.write("$S: config.$L,", scheme.getSchemeId().toString(), configField.name);
            }
          }
        }
      }
    );
    w.dedent();
  }

  private _generateHttpAuthSchemeInputConfigInterface(w: TypeScriptWriter, s: any): void {
    this._generateConfigInterface(w, s, {
      docs: "@public",
      name: "HttpAuthSchemeInputConfig",
      typeOf: (fn) => fn.inputConfig,
      authSchemePreference: "authSchemePreference?: string[] | Provider<string[]>;",
      httpAuthSchemes: "httpAuthSchemes?: HttpAuthScheme[];",
      httpAuthSchemeProvider: (name) => `httpAuthSchemeProvider?: ${name};`,
      field: (configField) => ["$L?: $T;", configField.name, configField.inputType],
      blank: true,
    });
  }

  private _generateHttpAuthSchemeResolvedConfigInterface(w: TypeScriptWriter, s: any): void {
    this._generateConfigInterface(w, s, {
      docs: "@internal",
      name: "HttpAuthSchemeResolvedConfig",
      typeOf: (fn) => fn.resolvedConfig,
      authSchemePreference: "readonly authSchemePreference: Provider<string[]>;\n",
      httpAuthSchemes: "readonly httpAuthSchemes: HttpAuthScheme[];\n",
      httpAuthSchemeProvider: (name) => `readonly httpAuthSchemeProvider: ${name};`,
      field: (configField) => ["readonly $L?: $T;", configField.name, configField.resolvedType],
      blank: false,
    });
  }

  private _generateConfigInterface(
    w: TypeScriptWriter,
    s: any,
    options: {
      docs: string;
      name: string;
      typeOf: (fn: ResolveConfigFunction) => Symbol;
      authSchemePreference: string;
      httpAuthSchemes: string;
      httpAuthSchemeProvider: (name: string) => string;
      field: (configField: ConfigField) => [string, ...unknown[]];
      blank: boolean;
    }
  ): void {
    w.pushState(s);
    const configFields = s.props.configFields as JavaHashMap<ConfigField>;
    const resolveConfigFunctions = s.props.resolveConfigFunctions as Map<string, ResolveConfigFunction>;
    const serviceName = CodegenUtils.getServiceName(s.props.settings, s.props.model, s.props.symbolProvider);
    w.writeDocs(options.docs);
    w.writeInline("export interface $L", options.name);
    if (resolveConfigFunctions.size > 0) {
      w.writeInline(" extends ");
      const fns = [...resolveConfigFunctions.values()];
      fns.forEach((fn, i) => {
        w.writeInline("$T", options.typeOf(fn));
        if (i < fns.length - 1) {
          w.writeInline(", ");
        }
      });
    }
    w.write(" {");
    w.indent();
    w.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
    w.writeDocs(
      "A comma-separated list of case-sensitive auth scheme names.\nAn auth scheme name is a fully qualified auth scheme ID with the namespace prefix trimmed.\nFor example, the auth scheme with ID aws.auth#sigv4 is named sigv4.\n@public"
    );
    w.write(options.authSchemePreference);
    if (options.blank) {
      w.write("");
    }
    w.addTypeImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
    w.writeDocs(
      "Configuration of HttpAuthSchemes for a client which provides default identity providers and signers per auth scheme.\n@internal"
    );
    w.write(options.httpAuthSchemes);
    if (options.blank) {
      w.write("");
    }
    const httpAuthSchemeProviderName = serviceName + "HttpAuthSchemeProvider";
    w.writeDocs(
      "Configuration of an HttpAuthSchemeProvider for a client which resolves which HttpAuthScheme to use.\n@internal"
    );
    w.write(options.httpAuthSchemeProvider(httpAuthSchemeProviderName));
    for (const configField of configFields.values()) {
      if (configField.configFieldWriter !== undefined) {
        if (configField.docs !== undefined) {
          const docs = configField.docs;
          w.writeDocs(() => w.write("$C", docs));
        }
        const [template, ...args] = options.field(configField);
        w.write(template, ...args);
      }
    }
    w.dedent();
    w.write("}");
    w.write("");
    w.popState();
  }

  private _generateResolveHttpAuthSchemeConfigFunction(w: TypeScriptWriter, s: any): void {
    w.pushState(s);
    const configFields = s.props.configFields as JavaHashMap<ConfigField>;
    const resolveConfigFunctions = s.props.resolveConfigFunctions as Map<string, ResolveConfigFunction>;
    const previousResolvedFunctions = [...resolveConfigFunctions.values()].filter(
      (e) => e.previouslyResolved !== undefined
    );

    w.writeDocs("@internal");
    w.writeInline("export const resolveHttpAuthSchemeConfig = <T>(\n  config: T & HttpAuthSchemeInputConfig");
    if (previousResolvedFunctions.length > 0) {
      w.writeInline(" & ");
      previousResolvedFunctions.forEach((fn, i) => {
        w.writeInline("$T", fn.previouslyResolved);
        if (i < previousResolvedFunctions.length - 1) {
          w.writeInline(" & ");
        }
      });
    }
    w.write("");
    w.write("): T & HttpAuthSchemeResolvedConfig => {");
    w.indent();

    const common = {
      service: s.props.service,
      settings: s.props.settings,
      model: s.props.model,
      symbolProvider: s.props.symbolProvider,
      integrations: s.props.integrations,
      configFields,
    };
    const subSection = (section: { builder(): any }) => {
      const builder = section.builder();
      for (const [key, value] of Object.entries(common)) {
        builder[key](value);
      }
      return builder.build();
    };
    w.pushState(subSection(ResolveHttpAuthSchemeConfigFunctionConfigFieldsCodeSection));
    w.addDependency(TypeScriptDependency.SMITHY_CORE);
    for (const configField of configFields.values()) {
      configField.configFieldWriter?.(w, configField);
    }
    w.popState();

    w.pushState(subSection(ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection));
    let i = 0;
    let configName = "config";
    for (const resolveConfigFunction of resolveConfigFunctions.values()) {
      const current = configName;
      w.openCollapsibleBlock(
        "const config_$L = $T($L",
        ");",
        resolveConfigFunction.addArgs.length > 0,
        i,
        resolveConfigFunction.resolveConfigFunction,
        current,
        () => {
          for (const addArg of resolveConfigFunction.addArgs) {
            w.writeInline(", $L", addArg);
          }
        }
      );
      configName = "config_" + i;
      i++;
    }
    w.write("return Object.assign($L, {", configName).indent();
    w.addImportSubmodule("normalizeProvider", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
    w.write("authSchemePreference: normalizeProvider(config.authSchemePreference ?? []),");
    for (const configField of configFields.values()) {
      if (configField.configFieldWriter !== undefined) {
        w.write("$L,", configField.name);
      }
    }
    w.dedent().write("}) as T & HttpAuthSchemeResolvedConfig;");
    w.popState();
    w.dedent();
    w.write("};");
    w.popState();
  }
}
