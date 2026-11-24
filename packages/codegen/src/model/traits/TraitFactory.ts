import { ExpectationNotMetException } from "../exceptions/exceptions";
import type { ShapeId } from "../shapes/ShapeId";
import {
  AddedDefaultTrait,
  BoxTrait,
  ClientOptionalTrait,
  EventHeaderTrait,
  EventPayloadTrait,
  HostLabelTrait,
  HttpBasicAuthTrait,
  HttpBearerAuthTrait,
  HttpChecksumRequiredTrait,
  HttpDigestAuthTrait,
  HttpLabelTrait,
  HttpPayloadTrait,
  HttpQueryParamsTrait,
  HttpResponseCodeTrait,
  IdempotencyTokenTrait,
  IdempotentTrait,
  InputTrait,
  InternalTrait,
  NoAuthTrait,
  OptionalAuthTrait,
  OutputTrait,
  PrivateTrait,
  ReadonlyTrait,
  RequiredTrait,
  RequiresLengthTrait,
  SensitiveTrait,
  SparseTrait,
  UniqueItemsTrait,
  XmlAttributeTrait,
  XmlFlattenedTrait,
} from "./AnnotationTraits";
import { AuthDefinitionTrait, AuthTrait, ProtocolDefinitionTrait } from "./AuthTraits";
import { DynamicTrait } from "./BaseTraits";
import { DefaultTrait } from "./DefaultTrait";
import { DeprecatedTrait } from "./DeprecatedTrait";
import { EndpointTrait } from "./EndpointTrait";
import { EnumTrait, EnumValueTrait } from "./EnumTrait";
import { ErrorTrait } from "./ErrorTrait";
import { ExamplesTrait } from "./ExamplesTrait";
import { HttpApiKeyAuthTrait } from "./HttpApiKeyAuthTrait";
import { HttpErrorTrait } from "./HttpErrorTrait";
import { HttpTrait } from "./HttpTrait";
import { LengthTrait } from "./LengthTrait";
import { MixinTrait } from "./MixinTrait";
import { PaginatedTrait } from "./PaginatedTrait";
import { PatternTrait } from "./PatternTrait";
import { RangeTrait } from "./RangeTrait";
import { RequestCompressionTrait } from "./RequestCompressionTrait";
import { RetryableTrait } from "./RetryableTrait";
import { StreamingTrait } from "./StreamingTrait";
import {
  DocumentationTrait,
  HttpHeaderTrait,
  HttpPrefixHeadersTrait,
  HttpQueryTrait,
  JsonNameTrait,
  MediaTypeTrait,
  SinceTrait,
  TitleTrait,
  XmlNameTrait,
} from "./StringTraits";
import { TagsTrait } from "./TagsTrait";
import { TimestampFormatTrait } from "./TimestampFormatTrait";
import type { Trait } from "./Trait";
import { UnitTypeTrait } from "./UnitTypeTrait";
import { XmlNamespaceTrait } from "./XmlNamespaceTrait";
import {
  ClientContextParamsTrait,
  ContextParamTrait,
  EndpointBddTrait,
  EndpointRuleSetTrait,
  OperationContextParamsTrait,
  StaticContextParamsTrait,
} from "./rules/RulesTraits";
import { Rpcv2CborTrait, Rpcv2JsonTrait } from "./protocol/Rpcv2Traits";
import {
  HttpMalformedRequestTestsTrait,
  HttpRequestTestsTrait,
  HttpResponseTestsTrait,
} from "./protocoltests/ProtocolTests";
import { WaitableTrait } from "./waiters/Waiters";

interface RegisteredTraitClass {
  readonly ID: ShapeId;
  new (value: unknown): Trait;
}

const REGISTRY = new Map<ShapeId, RegisteredTraitClass>();

/**
 * Creates typed traits from raw JSON values, falling back to {@link DynamicTrait} for unknown IDs.
 */
export class TraitFactory {
  public static createTrait(id: ShapeId, value: unknown): Trait {
    if (REGISTRY.size === 0) {
      registerAll();
    }
    const traitClass = REGISTRY.get(id);
    if (traitClass === undefined) {
      return new DynamicTrait(id, value);
    }
    try {
      return new traitClass(value);
    } catch (e) {
      throw new ExpectationNotMetException("Error creating trait `" + id + "`: " + (e as Error).message);
    }
  }
}

function registerAll(): void {
  const classes: RegisteredTraitClass[] = [
    AddedDefaultTrait,
    AuthDefinitionTrait,
    AuthTrait,
    BoxTrait,
    ClientContextParamsTrait,
    ClientOptionalTrait,
    ContextParamTrait,
    DefaultTrait,
    DeprecatedTrait,
    DocumentationTrait,
    EndpointBddTrait,
    EndpointRuleSetTrait,
    EndpointTrait,
    EnumTrait,
    EnumValueTrait,
    ErrorTrait,
    EventHeaderTrait,
    EventPayloadTrait,
    ExamplesTrait,
    HostLabelTrait,
    HttpApiKeyAuthTrait,
    HttpBasicAuthTrait,
    HttpBearerAuthTrait,
    HttpChecksumRequiredTrait,
    HttpDigestAuthTrait,
    HttpErrorTrait,
    HttpHeaderTrait,
    HttpLabelTrait,
    HttpMalformedRequestTestsTrait,
    HttpPayloadTrait,
    HttpPrefixHeadersTrait,
    HttpQueryParamsTrait,
    HttpQueryTrait,
    HttpRequestTestsTrait,
    HttpResponseCodeTrait,
    HttpResponseTestsTrait,
    HttpTrait,
    IdempotencyTokenTrait,
    IdempotentTrait,
    InputTrait,
    InternalTrait,
    JsonNameTrait,
    LengthTrait,
    MediaTypeTrait,
    MixinTrait,
    NoAuthTrait,
    OperationContextParamsTrait,
    OptionalAuthTrait,
    OutputTrait,
    PaginatedTrait,
    PatternTrait,
    PrivateTrait,
    ProtocolDefinitionTrait,
    RangeTrait,
    ReadonlyTrait,
    RequestCompressionTrait,
    RequiredTrait,
    RequiresLengthTrait,
    RetryableTrait,
    Rpcv2CborTrait,
    Rpcv2JsonTrait,
    SensitiveTrait,
    SinceTrait,
    SparseTrait,
    StaticContextParamsTrait,
    StreamingTrait,
    TagsTrait,
    TimestampFormatTrait,
    TitleTrait,
    UniqueItemsTrait,
    UnitTypeTrait,
    WaitableTrait,
    XmlAttributeTrait,
    XmlFlattenedTrait,
    XmlNameTrait,
    XmlNamespaceTrait,
  ];
  for (const traitClass of classes) {
    REGISTRY.set(traitClass.ID, traitClass);
  }
}
