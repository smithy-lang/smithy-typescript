import { Symbol } from "../../../../codegen-core";
import { ShapeId } from "../../../../model";
import { ApplicationProtocol } from "../../../ApplicationProtocol";
import { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import { LanguageTarget } from "../../../LanguageTarget";
import { TypeScriptDependency } from "../../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";
import type { TypeScriptWriter } from "../../../TypeScriptWriter";
import { ConfigField } from "../ConfigField";
import { HttpAuthScheme } from "../HttpAuthScheme";
import type { SupportedHttpAuthSchemesIndex } from "../SupportedHttpAuthSchemesIndex";
import type { HttpAuthTypeScriptIntegration } from "./HttpAuthTypeScriptIntegration";

const HTTP_BEARER_AUTH_SIGNER = (w: TypeScriptWriter): void => {
  w.write(
    "new $T()",
    Symbol.builder()
      .name("HttpBearerAuthSigner")
      .namespace(TypeScriptDependency.SMITHY_CORE.packageName, "/")
      .addDependency(TypeScriptDependency.SMITHY_CORE)
      .build()
  );
};

const typesSymbol = (name: string): Symbol =>
  Symbol.builder()
    .name(name)
    .namespace(TypeScriptDependency.SMITHY_TYPES.packageName, "/")
    .addDependency(TypeScriptDependency.SMITHY_TYPES)
    .build();

/**
 * Supports the smithy.api#httpBearerAuth scheme.
 */
export class SupportHttpBearerAuth extends TypeScriptIntegration implements HttpAuthTypeScriptIntegration {
  public matchesSettings(settings: TypeScriptSettings): boolean {
    return !settings.useLegacyAuth();
  }

  public getHttpAuthScheme(): HttpAuthScheme {
    const tokenIdentity = typesSymbol("TokenIdentity");
    const tokenIdentityProvider = typesSymbol("TokenIdentityProvider");
    return HttpAuthScheme.builder()
      .schemeId(ShapeId.from("smithy.api#httpBearerAuth"))
      .traitId(ShapeId.from("smithy.api#httpBearerAuth"))
      .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
      .addConfigField(
        ConfigField.builder()
          .name("token")
          .type("MAIN")
          .docs((w) => w.write("The token used to authenticate requests."))
          .inputType(
            Symbol.builder()
              .name("TokenIdentity | TokenIdentityProvider")
              .addReference(tokenIdentity)
              .addReference(tokenIdentityProvider)
              .build()
          )
          .resolvedType(Symbol.builder().name("TokenIdentityProvider").addReference(tokenIdentityProvider).build())
          .configFieldWriter(ConfigField.defaultMainConfigFieldWriter)
          .build()
      )
      .putDefaultSigner(LanguageTarget.SHARED, HTTP_BEARER_AUTH_SIGNER)
      .build();
  }

  public customizeSupportedHttpAuthSchemes(_index: SupportedHttpAuthSchemesIndex): void {}
}
