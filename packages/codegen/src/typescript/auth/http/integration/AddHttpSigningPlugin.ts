import { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import { RuntimeClientPlugin } from "../../../integration/RuntimeClientPlugin";
import { TypeScriptDependency } from "../../../TypeScriptDependency";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";

/**
 * Adds the HTTP signing middleware plugin.
 */
export class AddHttpSigningPlugin extends TypeScriptIntegration {
  public matchesSettings(settings: TypeScriptSettings): boolean {
    return !settings.useLegacyAuth();
  }

  public getClientPlugins(): RuntimeClientPlugin[] {
    return [
      RuntimeClientPlugin.builder()
        .withConventions(TypeScriptDependency.SMITHY_CORE.dependency, "HttpSigning", "HAS_MIDDLEWARE")
        .build(),
    ];
  }
}
