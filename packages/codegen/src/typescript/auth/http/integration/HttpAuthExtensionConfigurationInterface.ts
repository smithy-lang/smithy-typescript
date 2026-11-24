import type {
  ExtensionConfigurationInterface,
  NameAndDependency,
} from "../../../extensions/ExtensionConfigurationInterface";
import { AuthUtils } from "../../AuthUtils";

export class HttpAuthExtensionConfigurationInterface implements ExtensionConfigurationInterface {
  public name(): NameAndDependency {
    return ["HttpAuthExtensionConfiguration", AuthUtils.AUTH_HTTP_EXTENSION_DEPENDENCY];
  }

  public getExtensionConfigurationFn(): NameAndDependency {
    return ["getHttpAuthExtensionConfiguration", AuthUtils.AUTH_HTTP_EXTENSION_DEPENDENCY];
  }

  public resolveRuntimeConfigFn(): NameAndDependency {
    return ["resolveHttpAuthRuntimeConfig", AuthUtils.AUTH_HTTP_EXTENSION_DEPENDENCY];
  }
}
