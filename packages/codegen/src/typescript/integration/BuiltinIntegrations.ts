import { AddHttpAuthSchemePlugin } from "../auth/http/integration/AddHttpAuthSchemePlugin";
import { AddHttpSigningPlugin } from "../auth/http/integration/AddHttpSigningPlugin";
import { HttpAuthRuntimeExtensionIntegration } from "../auth/http/integration/HttpAuthRuntimeExtensionIntegration";
import { SupportHttpApiKeyAuth } from "../auth/http/integration/SupportHttpApiKeyAuth";
import { SupportHttpBearerAuth } from "../auth/http/integration/SupportHttpBearerAuth";
import { SupportNoAuth } from "../auth/http/integration/SupportNoAuth";
import { AddDefaultEndpointRuleSet } from "../endpointsV2/AddDefaultEndpointRuleSet";
import { AddProtocols } from "../protocols/AddProtocols";
import { AddBaseServiceExceptionClass } from "./AddBaseServiceExceptionClass";
import { AddBuiltinPlugins } from "./AddBuiltinPlugins";
import { AddChecksumRequiredDependency } from "./AddChecksumRequiredDependency";
import { AddClientRuntimeConfig } from "./AddClientRuntimeConfig";
import { AddCompressionDependency } from "./AddCompressionDependency";
import { AddDefaultsModeDependency } from "./AddDefaultsModeDependency";
import { AddEventStreamDependency } from "./AddEventStreamDependency";
import { AddHttp2Dependency } from "./AddHttp2Dependency";
import { AddProtocolConfig } from "./AddProtocolConfig";
import { AddSdkStreamMixinDependency } from "./AddSdkStreamMixinDependency";
import type { TypeScriptIntegration } from "./TypeScriptIntegration";

/**
 * Integrations registered on every codegen instance, in the order of the Java service file.
 */
export function createBuiltinIntegrations(): TypeScriptIntegration[] {
  return [
    new AddDefaultEndpointRuleSet(),
    new AddBuiltinPlugins(),
    new AddClientRuntimeConfig(),
    new AddProtocolConfig(),
    new AddEventStreamDependency(),
    new AddChecksumRequiredDependency(),
    new AddDefaultsModeDependency(),
    new AddHttpAuthSchemePlugin(),
    new AddHttpSigningPlugin(),
    new HttpAuthRuntimeExtensionIntegration(),
    new SupportNoAuth(),
    new SupportHttpApiKeyAuth(),
    new SupportHttpBearerAuth(),
    new AddBaseServiceExceptionClass(),
    new AddSdkStreamMixinDependency(),
    new AddCompressionDependency(),
    new AddProtocols(),
    new AddHttp2Dependency(),
  ];
}
