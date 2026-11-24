import { ShapeId } from "../shapes/ShapeId";
import { AnnotationTrait } from "./BaseTraits";

/**
 * @internal
 */
export class SensitiveTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#sensitive");

  constructor(value?: unknown) {
    super(SensitiveTrait.ID, value);
  }
}

/**
 * @internal
 */
export class SparseTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#sparse");

  constructor(value?: unknown) {
    super(SparseTrait.ID, value);
  }
}

/**
 * @internal
 */
export class UniqueItemsTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#uniqueItems");

  constructor(value?: unknown) {
    super(UniqueItemsTrait.ID, value);
  }
}

/**
 * @internal
 */
export class RequiredTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#required");

  constructor(value?: unknown) {
    super(RequiredTrait.ID, value);
  }
}

export class ClientOptionalTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#clientOptional");

  constructor(value?: unknown) {
    super(ClientOptionalTrait.ID, value);
  }
}

export class InputTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#input");

  constructor(value?: unknown) {
    super(InputTrait.ID, value);
  }
}

export class OutputTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#output");

  constructor(value?: unknown) {
    super(OutputTrait.ID, value);
  }
}

export class IdempotentTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#idempotent");

  constructor(value?: unknown) {
    super(IdempotentTrait.ID, value);
  }
}

/**
 * @internal
 */
export class IdempotencyTokenTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#idempotencyToken");

  constructor(value?: unknown) {
    super(IdempotencyTokenTrait.ID, value);
  }
}

export class HostLabelTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#hostLabel");

  constructor(value?: unknown) {
    super(HostLabelTrait.ID, value);
  }
}

/**
 * @internal
 */
export class HttpLabelTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpLabel");

  constructor(value?: unknown) {
    super(HttpLabelTrait.ID, value);
  }
}

/**
 * @internal
 */
export class HttpPayloadTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpPayload");

  constructor(value?: unknown) {
    super(HttpPayloadTrait.ID, value);
  }
}

export class HttpQueryParamsTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpQueryParams");

  constructor(value?: unknown) {
    super(HttpQueryParamsTrait.ID, value);
  }
}

export class HttpResponseCodeTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpResponseCode");

  constructor(value?: unknown) {
    super(HttpResponseCodeTrait.ID, value);
  }
}

export class EventHeaderTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#eventHeader");

  constructor(value?: unknown) {
    super(EventHeaderTrait.ID, value);
  }
}

export class EventPayloadTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#eventPayload");

  constructor(value?: unknown) {
    super(EventPayloadTrait.ID, value);
  }
}

/**
 * @internal
 */
export class InternalTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#internal");

  constructor(value?: unknown) {
    super(InternalTrait.ID, value);
  }
}

export class OptionalAuthTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#optionalAuth");

  constructor(value?: unknown) {
    super(OptionalAuthTrait.ID, value);
  }
}

export class RequiresLengthTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#requiresLength");

  constructor(value?: unknown) {
    super(RequiresLengthTrait.ID, value);
  }
}

export class XmlAttributeTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#xmlAttribute");

  constructor(value?: unknown) {
    super(XmlAttributeTrait.ID, value);
  }
}

export class XmlFlattenedTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#xmlFlattened");

  constructor(value?: unknown) {
    super(XmlFlattenedTrait.ID, value);
  }
}

export class BoxTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#box");

  constructor(value?: unknown) {
    super(BoxTrait.ID, value);
  }
}

export class AddedDefaultTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#addedDefault");

  constructor(value?: unknown) {
    super(AddedDefaultTrait.ID, value);
  }
}

export class PrivateTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#private");

  constructor(value?: unknown) {
    super(PrivateTrait.ID, value);
  }
}

export class ReadonlyTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#readonly");

  constructor(value?: unknown) {
    super(ReadonlyTrait.ID, value);
  }
}

export class HttpBearerAuthTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpBearerAuth");

  constructor(value?: unknown) {
    super(HttpBearerAuthTrait.ID, value);
  }
}

export class HttpBasicAuthTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpBasicAuth");

  constructor(value?: unknown) {
    super(HttpBasicAuthTrait.ID, value);
  }
}

export class HttpDigestAuthTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpDigestAuth");

  constructor(value?: unknown) {
    super(HttpDigestAuthTrait.ID, value);
  }
}

/**
 * @internal
 */
export class HttpChecksumRequiredTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpChecksumRequired");

  constructor(value?: unknown) {
    super(HttpChecksumRequiredTrait.ID, value);
  }
}

export class NoAuthTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#noAuth");

  constructor(value?: unknown) {
    super(NoAuthTrait.ID, value);
  }
}
