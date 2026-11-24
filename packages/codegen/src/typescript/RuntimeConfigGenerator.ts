import { CodegenException, Symbol, type SymbolProvider } from "../codegen-core";
import { type Model, ServiceIndex, type ServiceShape, TopDownIndex, TreeMap } from "../model";
import { AuthUtils } from "./auth/AuthUtils";
import type { HttpAuthScheme } from "./auth/http/HttpAuthScheme";
import { SupportedHttpAuthSchemesIndex } from "./auth/http/SupportedHttpAuthSchemesIndex";
import type { ApplicationProtocol } from "./ApplicationProtocol";
import { CodegenUtils } from "./CodegenUtils";
import type { TypeScriptIntegration } from "./integration/TypeScriptIntegration";
import { LanguageTarget } from "./LanguageTarget";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import type { TypeScriptDelegator } from "./TypeScriptDelegator";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { TypeScriptUtils } from "./TypeScriptUtils";
import type { TypeScriptWriter } from "./TypeScriptWriter";

type WriterConsumer = (writer: TypeScriptWriter) => void;

const coreImport =
  (name: string, submodule: string): WriterConsumer =>
  (writer) => {
    writer.addImportSubmodule(name, null, TypeScriptDependency.SMITHY_CORE, submodule);
    writer.write(name);
  };

const NODE_DEFAULTS = new Map<string, WriterConsumer>([
  [
    "requestHandler",
    (writer) => {
      writer.addImport("NodeHttpHandler", "RequestHandler", TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
      writer.write("RequestHandler.create(config?.requestHandler ?? defaultConfigProvider)");
    },
  ],
  ["bodyLengthChecker", coreImport("calculateBodyLength", SmithyCoreSubmodules.SERDE)],
  [
    "streamCollector",
    (writer) => {
      writer.addImport("streamCollector", null, TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
      writer.write("streamCollector");
    },
  ],
]);

const BROWSER_DEFAULTS = new Map<string, WriterConsumer>([
  [
    "requestHandler",
    (writer) => {
      writer.addImport("FetchHttpHandler", "RequestHandler", TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER);
      writer.write("RequestHandler.create(config?.requestHandler ?? defaultConfigProvider)");
    },
  ],
  ["bodyLengthChecker", coreImport("calculateBodyLength", SmithyCoreSubmodules.SERDE)],
  [
    "streamCollector",
    (writer) => {
      writer.addImport("streamCollector", null, TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER);
      writer.write("streamCollector");
    },
  ],
]);

const REACT_NATIVE_DEFAULTS = new Map<string, WriterConsumer>();

const SHARED_DEFAULTS = new Map<string, WriterConsumer>([
  ["base64Decoder", coreImport("fromBase64", SmithyCoreSubmodules.SERDE)],
  ["base64Encoder", coreImport("toBase64", SmithyCoreSubmodules.SERDE)],
  ["sha256", coreImport("Sha256", SmithyCoreSubmodules.CHECKSUM)],
  [
    "disableHostPrefix",
    (writer) => {
      writer.write("false");
    },
  ],
  ["urlParser", coreImport("parseUrl", SmithyCoreSubmodules.PROTOCOLS)],
  ["utf8Decoder", coreImport("fromUtf8", SmithyCoreSubmodules.SERDE)],
  ["utf8Encoder", coreImport("toUtf8", SmithyCoreSubmodules.SERDE)],
  [
    "extensions",
    (writer) => {
      writer.write("[]");
    },
  ],
]);

const RUNTIME_CONFIG_DEFAULT_VALUE_PREFIXES = new Map<string, string>([
  ["requestHandler", ""],
  ["defaultSocketTimeout", ""],
]);

interface HttpAuthSchemeTarget {
  httpAuthScheme: HttpAuthScheme;
  identityProvider: WriterConsumer | undefined;
  signer: WriterConsumer | undefined;
}

const inheritedTarget = (target: LanguageTarget): LanguageTarget | undefined => {
  switch (target) {
    case LanguageTarget.SHARED:
      return undefined;
    case LanguageTarget.NODE:
    case LanguageTarget.BROWSER:
      return LanguageTarget.SHARED;
    case LanguageTarget.REACT_NATIVE:
      return LanguageTarget.BROWSER;
    default:
      throw new CodegenException("Unsupported Language Target: " + target);
  }
};

const sameTargets = (a: HttpAuthSchemeTarget[], b: HttpAuthSchemeTarget[]): boolean =>
  a.length === b.length &&
  a.every(
    (entry, i) =>
      entry.httpAuthScheme === b[i].httpAuthScheme &&
      entry.identityProvider === b[i].identityProvider &&
      entry.signer === b[i].signer
  );

/**
 * Generates the runtimeConfig modules of a client.
 */
export class RuntimeConfigGenerator {
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _service: ServiceShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _delegator: TypeScriptDelegator;
  private readonly _integrations: TypeScriptIntegration[];
  private readonly _applicationProtocol: ApplicationProtocol;

  public constructor(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    delegator: TypeScriptDelegator,
    integrations: TypeScriptIntegration[],
    applicationProtocol: ApplicationProtocol
  ) {
    this._settings = settings;
    this._model = model;
    this._service = settings.getService(model);
    this._symbolProvider = symbolProvider;
    this._delegator = delegator;
    this._integrations = integrations;
    this._applicationProtocol = applicationProtocol;
  }

  public generate(target: LanguageTarget): void {
    const clientConfigName = this._symbolProvider.toSymbol(this._service).getName() + "Config";
    const clientModuleName = this._symbolProvider
      .toSymbol(this._service)
      .getNamespace()
      .replace(CodegenUtils.SOURCE_FOLDER + "/", "");
    const template = TypeScriptUtils.loadResourceAsString(target.getTemplateFileName());
    const contents = template
      .split("${clientConfigName}")
      .join(clientConfigName)
      .split("${apiVersion}")
      .join(this._service.getVersion() ?? "")
      .split("${")
      .join("$${")
      .split("$${customizations}")
      .join("${L@customizations}")
      .split("$${prepareCustomizations}")
      .join("${L@prepareCustomizations}");

    this._delegator.useFileWriter(target.getTargetFilename(), (writer) => {
      writer.trimBlankLines(0);
      writer.onSection("prepareCustomizations", () => {
        for (const integration of this._integrations) {
          integration.prepareCustomizations(writer, target, this._settings, this._model);
        }
      });
      writer.indent().onSection("customizations", () => {
        const configs = new TreeMap<string, WriterConsumer>(null, this._getDefaultRuntimeConfigs(target));
        for (const integration of this._integrations) {
          for (const [key, value] of integration.getRuntimeConfigWriters(
            this._settings,
            this._model,
            this._symbolProvider,
            target
          )) {
            configs.set(key, value);
          }
        }
        if (this._applicationProtocol.isHttpProtocol() && !this._settings.useLegacyAuth()) {
          this._generateHttpAuthSchemeConfig(configs, target);
        }
        for (const key of configs.keys()) {
          let valuePrefix = RUNTIME_CONFIG_DEFAULT_VALUE_PREFIXES.get(key) ?? "config?.$1L ?? ";
          if (key === "retryMode" && target === LanguageTarget.NODE) {
            valuePrefix = "\n  config?.retryMode ??\n";
          }
          writer.indent(2).writeInline("$1L: " + valuePrefix, key);
          configs.get(key)!(writer);
          writer.unwrite("\n");
          writer.dedent(2);
          writer.write(",");
        }
      });
      writer.dedent();
      writer.addRelativeTypeImport(
        clientConfigName,
        null,
        "./" + [CodegenUtils.SOURCE_FOLDER, clientModuleName].join("/")
      );
      switch (target) {
        case LanguageTarget.NODE:
        case LanguageTarget.BROWSER:
          writer.addRelativeImport(
            "getRuntimeConfig",
            "getSharedRuntimeConfig",
            "./" + [CodegenUtils.SOURCE_FOLDER, "runtimeConfig.shared"].join("/")
          );
          writer.addImportSubmodule(
            "loadConfigsForDefaultMode",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.CLIENT
          );
          break;
        default:
          break;
      }
      switch (target) {
        case LanguageTarget.NODE:
          writer.addImportSubmodule(
            "emitWarningIfUnsupportedVersion",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.CLIENT
          );
          writer.addImportSubmodule(
            "resolveDefaultsModeConfig",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.CONFIG
          );
          break;
        case LanguageTarget.BROWSER:
          writer.addImportSubmodule(
            "resolveDefaultsModeConfig",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.CONFIG
          );
          break;
        case LanguageTarget.REACT_NATIVE:
          writer.addRelativeImport(
            "getRuntimeConfig",
            "getBrowserRuntimeConfig",
            "./" + [CodegenUtils.SOURCE_FOLDER, "runtimeConfig.browser"].join("/")
          );
          break;
        default:
          break;
      }
      writer.write(contents, "", "");
    });
  }

  private _getDefaultRuntimeConfigs(target: LanguageTarget): Map<string, WriterConsumer> {
    switch (target) {
      case LanguageTarget.NODE:
        return NODE_DEFAULTS;
      case LanguageTarget.BROWSER:
        return BROWSER_DEFAULTS;
      case LanguageTarget.REACT_NATIVE:
        return REACT_NATIVE_DEFAULTS;
      case LanguageTarget.SHARED:
        return SHARED_DEFAULTS;
      default:
        throw new CodegenException("Unknown target: " + target);
    }
  }

  private _generateHttpAuthSchemeConfig(configs: Map<string, WriterConsumer>, target: LanguageTarget): void {
    const authIndex = new SupportedHttpAuthSchemesIndex(this._integrations, this._model, this._settings);
    if (target === LanguageTarget.SHARED) {
      configs.set("httpAuthSchemeProvider", (w) => {
        w.write(
          "$T",
          Symbol.builder()
            .name(
              "default" +
                CodegenUtils.getServiceName(this._settings, this._model, this._symbolProvider) +
                "HttpAuthSchemeProvider"
            )
            .namespace(AuthUtils.AUTH_HTTP_PROVIDER_DEPENDENCY.getPackageName(), "/")
            .build()
        );
      });
    }
    const allEffectiveHttpAuthSchemes = AuthUtils.getAllEffectiveNoAuthAwareAuthSchemes(
      this._service,
      ServiceIndex.of(this._model),
      authIndex,
      TopDownIndex.of(this._model)
    );
    const targetAuthSchemes = this._getHttpAuthSchemeTargets(target, allEffectiveHttpAuthSchemes);
    const inherited = inheritedTarget(target);
    const inheritedAuthSchemes =
      inherited === undefined ? [] : this._getHttpAuthSchemeTargets(inherited, allEffectiveHttpAuthSchemes);
    if (sameTargets(targetAuthSchemes, inheritedAuthSchemes)) {
      return;
    }
    configs.set("httpAuthSchemes", (w) => {
      w.addTypeImport("IdentityProviderConfig", null, TypeScriptDependency.SMITHY_TYPES);
      w.writeInline("[");
      if (targetAuthSchemes.length > 0) {
        w.write("");
      }
      for (const entry of targetAuthSchemes) {
        w.indent();
        if (entry.identityProvider === undefined) {
          w.writeInline(
            "{\n  schemeId: $S,\n  identityProvider: (ipc: IdentityProviderConfig) =>\n    ipc.getIdentityProvider($S),\n  signer: $C,\n}",
            entry.httpAuthScheme.getSchemeId().toString(),
            entry.httpAuthScheme.getSchemeId().toString(),
            entry.signer
          );
        } else {
          w.writeInline(
            "{\n  schemeId: $S,\n  identityProvider: (ipc: IdentityProviderConfig) =>\n    ipc.getIdentityProvider($S) || ($C),\n  signer: $C,\n}",
            entry.httpAuthScheme.getSchemeId().toString(),
            entry.httpAuthScheme.getSchemeId().toString(),
            entry.identityProvider,
            entry.signer
          );
        }
        w.write(",");
        w.dedent();
      }
      w.write("]");
    });
  }

  private _getHttpAuthSchemeTargets(
    target: LanguageTarget,
    httpAuthSchemes: Map<string, HttpAuthScheme | undefined>
  ): HttpAuthSchemeTarget[] {
    return [...this._getPartialHttpAuthSchemeTargets(target, httpAuthSchemes).values()].filter(
      (entry) => entry.signer !== undefined
    );
  }

  private _getPartialHttpAuthSchemeTargets(
    target: LanguageTarget,
    httpAuthSchemes: Map<string, HttpAuthScheme | undefined>
  ): Map<string, HttpAuthSchemeTarget> {
    const inherited = inheritedTarget(target);
    const targets =
      inherited === undefined
        ? new TreeMap<string, HttpAuthSchemeTarget>()
        : this._getPartialHttpAuthSchemeTargets(inherited, httpAuthSchemes);
    for (const httpAuthScheme of httpAuthSchemes.values()) {
      if (httpAuthScheme === undefined) {
        continue;
      }
      const identityProvider = httpAuthScheme.getDefaultIdentityProviders().get(target);
      const signer = httpAuthScheme.getDefaultSigners().get(target);
      const key = httpAuthScheme.getSchemeId().toString();
      const existing = targets.get(key);
      if (existing === undefined) {
        targets.set(key, { httpAuthScheme, identityProvider, signer });
        continue;
      }
      if (identityProvider !== undefined) {
        existing.identityProvider = identityProvider;
      }
      if (signer !== undefined) {
        existing.signer = signer;
      }
    }
    return targets;
  }
}
