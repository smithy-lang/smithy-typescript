import { ShapeId } from "../shapes/ShapeId";
import { StringTrait } from "./BaseTraits";

/**
 * @internal
 */
export class DocumentationTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#documentation");

  constructor(value: unknown) {
    super(DocumentationTrait.ID, value);
  }
}

export class HttpHeaderTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpHeader");

  constructor(value: unknown) {
    super(HttpHeaderTrait.ID, value);
  }
}

/**
 * @internal
 */
export class HttpPrefixHeadersTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpPrefixHeaders");

  constructor(value: unknown) {
    super(HttpPrefixHeadersTrait.ID, value);
  }
}

export class HttpQueryTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpQuery");

  constructor(value: unknown) {
    super(HttpQueryTrait.ID, value);
  }
}

export class JsonNameTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#jsonName");

  constructor(value: unknown) {
    super(JsonNameTrait.ID, value);
  }
}

/**
 * @internal
 */
export class MediaTypeTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#mediaType");

  constructor(value: unknown) {
    super(MediaTypeTrait.ID, value);
  }
}

export class XmlNameTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#xmlName");

  constructor(value: unknown) {
    super(XmlNameTrait.ID, value);
  }
}

export class SinceTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#since");

  constructor(value: unknown) {
    super(SinceTrait.ID, value);
  }
}

export class TitleTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#title");

  constructor(value: unknown) {
    super(TitleTrait.ID, value);
  }
}
