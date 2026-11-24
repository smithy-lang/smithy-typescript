import type { Model, ShapeId } from "../../../model";
import type { TypeScriptIntegration } from "../../integration/TypeScriptIntegration";
import type { TypeScriptSettings } from "../../TypeScriptSettings";
import type { HttpAuthScheme } from "./HttpAuthScheme";
import { isHttpAuthTypeScriptIntegration } from "./integration/HttpAuthTypeScriptIntegration";

/**
 * Collects the HTTP auth schemes that integrations support.
 */
export class SupportedHttpAuthSchemesIndex {
  private readonly _supportedHttpAuthSchemes = new Map<string, HttpAuthScheme>();

  public constructor(integrations: TypeScriptIntegration[], model: Model, settings: TypeScriptSettings) {
    for (const integration of integrations) {
      if (!isHttpAuthTypeScriptIntegration(integration)) {
        continue;
      }
      const authScheme = integration.getHttpAuthScheme();
      if (authScheme !== undefined) {
        this.putHttpAuthScheme(authScheme.getSchemeId(), authScheme);
      }
      integration.customizeSupportedHttpAuthSchemes(this, model, settings);
    }
  }

  public putHttpAuthScheme(schemeId: ShapeId, authScheme: HttpAuthScheme): HttpAuthScheme | undefined {
    const previous = this._supportedHttpAuthSchemes.get(schemeId.toString());
    this._supportedHttpAuthSchemes.set(schemeId.toString(), authScheme);
    return previous;
  }

  public getHttpAuthScheme(schemeId: ShapeId): HttpAuthScheme | undefined {
    return this._supportedHttpAuthSchemes.get(schemeId.toString());
  }
}
