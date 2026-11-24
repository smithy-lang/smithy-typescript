import type { Symbol } from "../../../codegen-core";
import type { ShapeId } from "../../../model";
import type { ApplicationProtocol } from "../../ApplicationProtocol";
import type { LanguageTarget } from "../../LanguageTarget";
import type { TypeScriptWriter } from "../../TypeScriptWriter";
import type { ConfigField } from "./ConfigField";
import type { HttpAuthOptionProperty, HttpAuthOptionPropertyType } from "./HttpAuthOptionProperty";
import type { HttpAuthSchemeParameter } from "./HttpAuthSchemeParameter";
import type { ResolveConfigFunction } from "./ResolveConfigFunction";

type WriterConsumer = (writer: TypeScriptWriter) => void;
type PropertiesExtractor = (symbol: Symbol) => WriterConsumer;

/**
 * Describes how an HTTP auth scheme contributes to generated clients.
 *
 * @internal
 */
export class HttpAuthScheme {
  public readonly schemeId: ShapeId;
  public readonly traitId: ShapeId;
  public readonly applicationProtocol: ApplicationProtocol;
  public readonly defaultIdentityProviders: Map<LanguageTarget, WriterConsumer>;
  public readonly defaultSigners: Map<LanguageTarget, WriterConsumer>;
  public readonly configFields: ConfigField[];
  public readonly resolveConfigFunctions: ResolveConfigFunction[];
  public readonly httpAuthSchemeParameters: HttpAuthSchemeParameter[];
  public readonly httpAuthOptionProperties: HttpAuthOptionProperty[];
  public readonly propertiesExtractor: PropertiesExtractor | undefined;

  public constructor(builder: HttpAuthSchemeBuilder) {
    if (
      builder._schemeId === undefined ||
      builder._traitId === undefined ||
      builder._applicationProtocol === undefined
    ) {
      throw new Error("Missing required state for HttpAuthScheme");
    }
    this.schemeId = builder._schemeId;
    this.traitId = builder._traitId;
    this.applicationProtocol = builder._applicationProtocol;
    this.defaultIdentityProviders = new Map(builder._defaultIdentityProviders);
    this.defaultSigners = new Map(builder._defaultSigners);
    this.configFields = [...builder._configFields];
    this.resolveConfigFunctions = [...builder._resolveConfigFunctions];
    this.httpAuthSchemeParameters = [...builder._httpAuthSchemeParameters];
    this.httpAuthOptionProperties = [...builder._httpAuthOptionProperties];
    this.propertiesExtractor = builder._propertiesExtractor;
  }

  public static builder(): HttpAuthSchemeBuilder {
    return new HttpAuthSchemeBuilder();
  }

  public getSchemeId(): ShapeId {
    return this.schemeId;
  }

  public getTraitId(): ShapeId {
    return this.traitId;
  }

  public getDefaultIdentityProviders(): Map<LanguageTarget, WriterConsumer> {
    return this.defaultIdentityProviders;
  }

  public getDefaultSigners(): Map<LanguageTarget, WriterConsumer> {
    return this.defaultSigners;
  }

  public getConfigFields(): ConfigField[] {
    return this.configFields;
  }

  public getResolveConfigFunctions(): ResolveConfigFunction[] {
    return this.resolveConfigFunctions;
  }

  public getHttpAuthSchemeParameters(): HttpAuthSchemeParameter[] {
    return this.httpAuthSchemeParameters;
  }

  public getHttpAuthSchemeOptionParametersByType(type: HttpAuthOptionPropertyType): HttpAuthOptionProperty[] {
    return this.httpAuthOptionProperties.filter((p) => p.type === type);
  }

  public getPropertiesExtractor(): PropertiesExtractor | undefined {
    return this.propertiesExtractor;
  }
}

class HttpAuthSchemeBuilder {
  public _schemeId: ShapeId | undefined;
  public _traitId: ShapeId | undefined;
  public _applicationProtocol: ApplicationProtocol | undefined;
  public _defaultIdentityProviders = new Map<LanguageTarget, WriterConsumer>();
  public _defaultSigners = new Map<LanguageTarget, WriterConsumer>();
  public _configFields: ConfigField[] = [];
  public _resolveConfigFunctions: ResolveConfigFunction[] = [];
  public _httpAuthSchemeParameters: HttpAuthSchemeParameter[] = [];
  public _httpAuthOptionProperties: HttpAuthOptionProperty[] = [];
  public _propertiesExtractor: PropertiesExtractor | undefined;

  public build(): HttpAuthScheme {
    return new HttpAuthScheme(this);
  }

  public schemeId(schemeId: ShapeId): this {
    this._schemeId = schemeId;
    return this;
  }

  public traitId(traitId: ShapeId): this {
    this._traitId = traitId;
    return this;
  }

  public applicationProtocol(applicationProtocol: ApplicationProtocol): this {
    this._applicationProtocol = applicationProtocol;
    return this;
  }

  public putDefaultIdentityProvider(languageTarget: LanguageTarget, identityProvider: WriterConsumer): this {
    this._defaultIdentityProviders.set(languageTarget, identityProvider);
    return this;
  }

  public putDefaultSigner(languageTarget: LanguageTarget, signer: WriterConsumer): this {
    this._defaultSigners.set(languageTarget, signer);
    return this;
  }

  public addConfigField(configField: ConfigField): this {
    this._configFields.push(configField);
    return this;
  }

  public addHttpAuthOptionProperty(property: HttpAuthOptionProperty): this {
    this._httpAuthOptionProperties.push(property);
    return this;
  }
}
