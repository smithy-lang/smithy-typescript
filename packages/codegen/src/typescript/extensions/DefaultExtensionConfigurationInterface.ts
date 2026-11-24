import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { ExtensionConfigurationInterface, NameAndDependency } from "./ExtensionConfigurationInterface";

export class DefaultExtensionConfigurationInterface implements ExtensionConfigurationInterface {
  public name(): NameAndDependency {
    return ["DefaultExtensionConfiguration", TypeScriptDependency.SMITHY_TYPES];
  }

  public getExtensionConfigurationFn(): NameAndDependency {
    return ["getDefaultExtensionConfiguration", TypeScriptDependency.SMITHY_CORE];
  }

  public resolveRuntimeConfigFn(): NameAndDependency {
    return ["resolveDefaultRuntimeConfig", TypeScriptDependency.SMITHY_CORE];
  }

  public submodule(): string {
    return SmithyCoreSubmodules.CLIENT;
  }
}
