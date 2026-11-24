import { Symbol } from "../../../../codegen-core";
import { ShapeId } from "../../../../model";
import { ApplicationProtocol } from "../../../ApplicationProtocol";
import { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import { LanguageTarget } from "../../../LanguageTarget";
import { TypeScriptDependency } from "../../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";
import type { TypeScriptWriter } from "../../../TypeScriptWriter";
import { HttpAuthScheme } from "../HttpAuthScheme";
import type { SupportedHttpAuthSchemesIndex } from "../SupportedHttpAuthSchemesIndex";
import type { HttpAuthTypeScriptIntegration } from "./HttpAuthTypeScriptIntegration";

const NO_AUTH_IDENTITY_PROVIDER_WRITER = (w: TypeScriptWriter): void => {
  w.write("async () => ({})");
};

const NO_AUTH_SIGNER_WRITER = (w: TypeScriptWriter): void => {
  w.write(
    "new $T()",
    Symbol.builder()
      .name("NoAuthSigner")
      .namespace(TypeScriptDependency.SMITHY_CORE.packageName, "/")
      .addDependency(TypeScriptDependency.SMITHY_CORE)
      .build()
  );
};

/**
 * Supports the smithy.api#noAuth scheme.
 */
export class SupportNoAuth extends TypeScriptIntegration implements HttpAuthTypeScriptIntegration {
  public matchesSettings(settings: TypeScriptSettings): boolean {
    return !settings.useLegacyAuth();
  }

  public getHttpAuthScheme(): HttpAuthScheme {
    return HttpAuthScheme.builder()
      .schemeId(ShapeId.from("smithy.api#noAuth"))
      .traitId(ShapeId.from("smithy.api#noAuth"))
      .applicationProtocol(ApplicationProtocol.createDefaultHttpApplicationProtocol())
      .putDefaultIdentityProvider(LanguageTarget.SHARED, NO_AUTH_IDENTITY_PROVIDER_WRITER)
      .putDefaultSigner(LanguageTarget.SHARED, NO_AUTH_SIGNER_WRITER)
      .build();
  }

  public customizeSupportedHttpAuthSchemes(_index: SupportedHttpAuthSchemesIndex): void {}
}
