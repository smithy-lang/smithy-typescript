import { TypeScriptDependency } from "../TypeScriptDependency";
import { RuntimeClientPlugin } from "./RuntimeClientPlugin";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

/**
 * Adds the retry and content length plugins.
 */
export class AddBuiltinPlugins extends TypeScriptIntegration {
  public getClientPlugins(): RuntimeClientPlugin[] {
    const version = TypeScriptDependency.SMITHY_CORE.dependency.getVersion();
    return [
      RuntimeClientPlugin.builder().withConventions("@smithy/core/retry", version, "Retry").build(),
      RuntimeClientPlugin.builder()
        .withConventions("@smithy/core/protocols", version, "ContentLength", "HAS_MIDDLEWARE")
        .build(),
    ];
  }
}
