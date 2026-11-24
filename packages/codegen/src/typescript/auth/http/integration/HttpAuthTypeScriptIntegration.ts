import type { Model } from "../../../../model";
import type { TypeScriptIntegration } from "../../../integration/TypeScriptIntegration";
import type { TypeScriptSettings } from "../../../TypeScriptSettings";
import type { HttpAuthScheme } from "../HttpAuthScheme";
import type { SupportedHttpAuthSchemesIndex } from "../SupportedHttpAuthSchemesIndex";

/**
 * Integration that supplies an HTTP auth scheme.
 */
export interface HttpAuthTypeScriptIntegration extends TypeScriptIntegration {
  getHttpAuthScheme(): HttpAuthScheme | undefined;
  customizeSupportedHttpAuthSchemes(
    supportedHttpAuthSchemesIndex: SupportedHttpAuthSchemesIndex,
    model: Model,
    settings: TypeScriptSettings
  ): void;
}

export const isHttpAuthTypeScriptIntegration = (
  integration: TypeScriptIntegration
): integration is HttpAuthTypeScriptIntegration =>
  typeof (integration as Partial<HttpAuthTypeScriptIntegration>).getHttpAuthScheme === "function";
