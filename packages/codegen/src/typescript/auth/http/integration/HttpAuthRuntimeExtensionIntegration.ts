import { ServiceIndex, TopDownIndex } from "../../../../model";
import type { Model } from "../../../../model";
import { CodegenUtils } from "../../../CodegenUtils";
import type { ExtensionConfigurationInterface } from "../../../extensions/ExtensionConfigurationInterface";
import { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import type { TypeScriptCodegenContext } from "../../../TypeScriptCodegenContext";
import type { TypeScriptDelegator } from "../../../TypeScriptDelegator";
import { TypeScriptDependency } from "../../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";
import type { JavaHashMap } from "../../../util";
import { AuthUtils } from "../../AuthUtils";
import type { ConfigField } from "../ConfigField";
import { SupportedHttpAuthSchemesIndex } from "../SupportedHttpAuthSchemesIndex";
import { HttpAuthExtensionConfigurationInterface } from "./HttpAuthExtensionConfigurationInterface";

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const mainConfigFields = (configFields: JavaHashMap<ConfigField>): ConfigField[] =>
  [...configFields.values()].filter((c) => c.type === "MAIN");

/**
 * Generates the HttpAuthExtensionConfiguration module.
 */
export class HttpAuthRuntimeExtensionIntegration extends TypeScriptIntegration {
  public matchesSettings(settings: TypeScriptSettings): boolean {
    return !settings.useLegacyAuth();
  }

  public getExtensionConfigurationInterfaces(
    _model: Model,
    _settings: TypeScriptSettings
  ): ExtensionConfigurationInterface[] {
    return [new HttpAuthExtensionConfigurationInterface()];
  }

  public customize(codegenContext: TypeScriptCodegenContext): void {
    if (!codegenContext.settings().generateClient()) {
      return;
    }
    const delegator = codegenContext.writerDelegator();
    const authIndex = new SupportedHttpAuthSchemesIndex(
      codegenContext.integrations(),
      codegenContext.model(),
      codegenContext.settings()
    );
    const serviceName = CodegenUtils.getServiceName(
      codegenContext.settings(),
      codegenContext.model(),
      codegenContext.symbolProvider()
    );
    const serviceShape = codegenContext.settings().getService(codegenContext.model());
    const effectiveAuthSchemes = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(
      serviceShape,
      ServiceIndex.of(codegenContext.model()),
      authIndex,
      TopDownIndex.of(codegenContext.model())
    );
    const configFields = AuthUtils.collectConfigFields(effectiveAuthSchemes.values());
    this._generateHttpAuthExtensionConfigurationInterface(delegator, configFields, serviceName);
    this._generateHttpAuthExtensionRuntimeConfigType(delegator, configFields, serviceName);
    this._generateGetHttpAuthExtensionConfigurationFunction(delegator, configFields, serviceName);
    this._generateResolveHttpAuthRuntimeConfigFunction(delegator, configFields);
  }

  private _generateHttpAuthExtensionConfigurationInterface(
    delegator: TypeScriptDelegator,
    configFields: JavaHashMap<ConfigField>,
    serviceName: string
  ): void {
    delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, (w) => {
      w.openBlock("/**\n * @internal\n */\nexport interface HttpAuthExtensionConfiguration {", "}", () => {
        w.addTypeImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
        w.write("setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void;");
        w.write("httpAuthSchemes(): HttpAuthScheme[];");
        w.addTypeImport(serviceName + "HttpAuthSchemeProvider", null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
        w.write("setHttpAuthSchemeProvider(httpAuthSchemeProvider: $LHttpAuthSchemeProvider): void;", serviceName);
        w.write("httpAuthSchemeProvider(): $LHttpAuthSchemeProvider;", serviceName);
        for (const configField of mainConfigFields(configFields)) {
          w.write("set$L($L: $T): void;", capitalize(configField.name), configField.name, configField.inputType);
          w.write("$L(): $T | undefined;", configField.name, configField.inputType);
        }
      });
    });
  }

  private _generateHttpAuthExtensionRuntimeConfigType(
    delegator: TypeScriptDelegator,
    configFields: JavaHashMap<ConfigField>,
    serviceName: string
  ): void {
    delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, (w) => {
      w.openBlock("/**\n * @internal\n */\nexport type HttpAuthRuntimeConfig = Partial<{", "}>;", () => {
        w.addTypeImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
        w.write("httpAuthSchemes: HttpAuthScheme[];");
        w.addTypeImport(serviceName + "HttpAuthSchemeProvider", null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
        w.write("httpAuthSchemeProvider: $LHttpAuthSchemeProvider;", serviceName);
        for (const configField of mainConfigFields(configFields)) {
          w.write("$L: $T;", configField.name, configField.inputType);
        }
      });
    });
  }

  private _generateGetHttpAuthExtensionConfigurationFunction(
    delegator: TypeScriptDelegator,
    configFields: JavaHashMap<ConfigField>,
    serviceName: string
  ): void {
    delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, (w) => {
      w.openBlock(
        "/**\n * @internal\n */\nexport const getHttpAuthExtensionConfiguration = (\n  runtimeConfig: HttpAuthRuntimeConfig\n): HttpAuthExtensionConfiguration => {",
        "};",
        () => {
          w.addTypeImport("HttpAuthScheme", null, TypeScriptDependency.SMITHY_TYPES);
          w.write("const _httpAuthSchemes = runtimeConfig.httpAuthSchemes!;");
          w.addTypeImport(serviceName + "HttpAuthSchemeProvider", null, AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY);
          w.write("let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider!;");
          const fields = mainConfigFields(configFields);
          for (const configField of fields) {
            w.write("let _$L = runtimeConfig.$L;", configField.name, configField.name);
          }
          w.openBlock("return {", "};", () => {
            w.write(
              "setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void {\n  const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);\n  if (index === -1) {\n    _httpAuthSchemes.push(httpAuthScheme);\n  } else {\n    _httpAuthSchemes.splice(index, 1, httpAuthScheme);\n  }\n},\nhttpAuthSchemes(): HttpAuthScheme[] {\n  return _httpAuthSchemes;\n},"
            );
            w.write(
              "setHttpAuthSchemeProvider(httpAuthSchemeProvider: $LHttpAuthSchemeProvider): void {\n  _httpAuthSchemeProvider = httpAuthSchemeProvider;\n},\nhttpAuthSchemeProvider(): $LHttpAuthSchemeProvider {\n  return _httpAuthSchemeProvider;\n},",
              serviceName,
              serviceName
            );
            for (const configField of fields) {
              w.write(
                "set$L($L: $T): void {\n  _$L = $L;\n},\n$L(): $T | undefined {\n  return _$L;\n},",
                capitalize(configField.name),
                configField.name,
                configField.inputType,
                configField.name,
                configField.name,
                configField.name,
                configField.inputType,
                configField.name
              );
            }
          });
        }
      );
    });
  }

  private _generateResolveHttpAuthRuntimeConfigFunction(
    delegator: TypeScriptDelegator,
    configFields: JavaHashMap<ConfigField>
  ): void {
    delegator.useFileWriter(AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_PATH, (w) => {
      w.openBlock(
        "/**\n * @internal\n */\nexport const resolveHttpAuthRuntimeConfig = (config: HttpAuthExtensionConfiguration): HttpAuthRuntimeConfig => {",
        "};",
        () => {
          w.openBlock("return {", "};", () => {
            w.write("httpAuthSchemes: config.httpAuthSchemes(),");
            w.write("httpAuthSchemeProvider: config.httpAuthSchemeProvider(),");
            for (const configField of mainConfigFields(configFields)) {
              w.write("$L: config.$L(),", configField.name, configField.name);
            }
          });
        }
      );
    });
  }
}
