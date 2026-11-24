import { CodegenException, Symbol } from "../../../../codegen-core";
import { HttpApiKeyAuthTrait } from "../../../../model";
import { ApplicationProtocol } from "../../../ApplicationProtocol";
import { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import { LanguageTarget } from "../../../LanguageTarget";
import { TypeScriptDependency } from "../../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";
import type { TypeScriptWriter } from "../../../TypeScriptWriter";
import { ConfigField } from "../ConfigField";
import { HttpAuthOptionProperty } from "../HttpAuthOptionProperty";
import { HttpAuthScheme } from "../HttpAuthScheme";
import type { SupportedHttpAuthSchemesIndex } from "../SupportedHttpAuthSchemesIndex";
import type { HttpAuthTypeScriptIntegration } from "./HttpAuthTypeScriptIntegration";

const HTTP_API_KEY_AUTH_SIGNER = (w: TypeScriptWriter): void => {
  w.write(
    "new $T()",
    Symbol.builder()
      .name("HttpApiKeyAuthSigner")
      .namespace(TypeScriptDependency.SMITHY_CORE.packageName, "/")
      .addDependency(TypeScriptDependency.SMITHY_CORE)
      .build()
  );
};

const typesSymbol = (name: string, typeOnly: boolean): Symbol => {
  const builder = Symbol.builder()
    .name(name)
    .namespace(TypeScriptDependency.SMITHY_TYPES.packageName, "/")
    .addDependency(TypeScriptDependency.SMITHY_TYPES);
  if (typeOnly) {
    builder.putProperty("typeOnly", true);
  }
  return builder.build();
};

/**
 * Supports the smithy.api#httpApiKeyAuth scheme.
 */
export class SupportHttpApiKeyAuth extends TypeScriptIntegration implements HttpAuthTypeScriptIntegration {
  public matchesSettings(settings: TypeScriptSettings): boolean {
    return !settings.useLegacyAuth();
  }

  public getHttpAuthScheme(): HttpAuthScheme {
    const apiKeyIdentity = typesSymbol("ApiKeyIdentity", true);
    const apiKeyIdentityProvider = typesSymbol("ApiKeyIdentityProvider", true);
    const httpApiKeyLocation = typesSymbol("HttpApiKeyAuthLocation", false);
    return HttpAuthScheme.builder()
      .schemeId(HttpApiKeyAuthTrait.ID)
      .traitId(HttpApiKeyAuthTrait.ID)
      .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
      .addConfigField(
        ConfigField.builder()
          .name("apiKey")
          .type("MAIN")
          .docs((w) => w.write("The API key to use when making requests."))
          .inputType(
            Symbol.builder()
              .name("ApiKeyIdentity | ApiKeyIdentityProvider")
              .addReference(apiKeyIdentity)
              .addReference(apiKeyIdentityProvider)
              .build()
          )
          .resolvedType(Symbol.builder().name("ApiKeyIdentityProvider").addReference(apiKeyIdentityProvider).build())
          .configFieldWriter(ConfigField.defaultMainConfigFieldWriter)
          .build()
      )
      .addHttpAuthOptionProperty(
        HttpAuthOptionProperty.builder()
          .name("name")
          .type("SIGNING")
          .source((s) => (w) => w.write("$S", (s.trait as HttpApiKeyAuthTrait).getName()))
          .build()
      )
      .addHttpAuthOptionProperty(
        HttpAuthOptionProperty.builder()
          .name("in")
          .type("SIGNING")
          .source((s) => (w) => {
            const location = (s.trait as HttpApiKeyAuthTrait).getIn();
            switch (location) {
              case "header":
                w.write("$T.HEADER", httpApiKeyLocation);
                break;
              case "query":
                w.write("$T.QUERY", httpApiKeyLocation);
                break;
              default:
                throw new CodegenException(
                  `Encountered unsupported \`in\` property on \`@httpApiKeyAuth\`: ${location}`
                );
            }
          })
          .build()
      )
      .addHttpAuthOptionProperty(
        HttpAuthOptionProperty.builder()
          .name("scheme")
          .type("SIGNING")
          .source((s) => (w) => {
            const scheme = (s.trait as HttpApiKeyAuthTrait).getScheme();
            if (scheme !== undefined) {
              w.write("$S", scheme);
            } else {
              w.write("undefined");
            }
          })
          .build()
      )
      .putDefaultSigner(LanguageTarget.SHARED, HTTP_API_KEY_AUTH_SIGNER)
      .build();
  }

  public customizeSupportedHttpAuthSchemes(_index: SupportedHttpAuthSchemesIndex): void {}
}
