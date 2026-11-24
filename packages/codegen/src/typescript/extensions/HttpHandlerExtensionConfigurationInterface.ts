import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { ExtensionConfigurationInterface, NameAndDependency } from "./ExtensionConfigurationInterface";

export class HttpHandlerExtensionConfigurationInterface implements ExtensionConfigurationInterface {
  public name(): NameAndDependency {
    return ["HttpHandlerExtensionConfiguration", TypeScriptDependency.SMITHY_CORE];
  }

  public submodule(): string {
    return SmithyCoreSubmodules.PROTOCOLS;
  }

  public getExtensionConfigurationFn(): NameAndDependency {
    return ["getHttpHandlerExtensionConfiguration", TypeScriptDependency.SMITHY_CORE];
  }

  public resolveRuntimeConfigFn(): NameAndDependency {
    return ["resolveHttpHandlerRuntimeConfig", TypeScriptDependency.SMITHY_CORE];
  }
}
