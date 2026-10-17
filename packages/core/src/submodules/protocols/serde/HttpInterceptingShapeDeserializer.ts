import { NormalizedSchema } from "@smithy/core/schema";
import { fromUtf8, toUtf8 } from "@smithy/core/serde";
import type { CodecSettings, Schema, SerdeFunctions, ShapeDeserializer } from "@smithy/types";

import {
  getHttpBindingValue,
  type HttpBindingLocation,
  type HttpBindingValue,
  type HttpHeader,
  type HttpPayload,
} from "../HttpBindingSchemaExtension";
import { SerdeContext } from "../SerdeContext";
import { FromStringShapeDeserializer } from "./FromStringShapeDeserializer";

/**
 * This deserializer is a dispatcher that decides whether to use a string deserializer
 * or a codec deserializer based on HTTP traits.
 *
 * For example, in a JSON HTTP message, the deserialization of a field will differ depending on whether
 * it is bound to the HTTP header (string) or body (JSON).
 *
 * @public
 */
export class HttpInterceptingShapeDeserializer<CodecShapeDeserializer extends ShapeDeserializer<any>>
  extends SerdeContext
  implements ShapeDeserializer<string | Uint8Array>
{
  private stringDeserializer: FromStringShapeDeserializer;

  public constructor(
    private codecDeserializer: CodecShapeDeserializer,
    codecSettings: CodecSettings
  ) {
    super();
    this.stringDeserializer = new FromStringShapeDeserializer(codecSettings);
  }

  /**
   * @override
   */
  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.stringDeserializer.setSerdeContext(serdeContext);
    this.codecDeserializer.setSerdeContext(serdeContext);
    this.serdeContext = serdeContext;
  }

  public read(schema: Schema, data: string | Uint8Array): any | Promise<any> {
    const ns = NormalizedSchema.of(schema);
    const traits = ns.getMergedTraits();

    if (traits.httpHeader || traits.httpResponseCode) {
      const value = getHttpBindingValue(ns, 0b100_110 satisfies HttpHeader, traits);
      return this.readHttpBinding(value, data, 0b100_110 satisfies HttpHeader);
    }
    if (traits.httpPayload) {
      return this.readPayload(getHttpBindingValue(ns, 0b100_100 satisfies HttpPayload, traits), data);
    }
    return this.readCodec(ns, data);
  }

  /** @internal */
  public readHttpBinding(binding: HttpBindingValue, data: string | Uint8Array, location: HttpBindingLocation): any {
    const value = typeof data === "string" ? data : (this.serdeContext?.utf8Encoder ?? toUtf8)(data);
    return this.stringDeserializer.readHttpBinding(binding, value, location);
  }

  /** @internal */
  public readPayload([schema, flags]: HttpBindingValue, data: string | Uint8Array): any | Promise<any> {
    const type = flags & 0xff;
    if (type === 21 || type === 42) {
      const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8;
      return typeof data === "string" ? toBytes(data) : data;
    }
    if (type === 0) {
      const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
      return typeof data === "string" ? data : toString(data);
    }
    return this.readCodec(schema, data);
  }

  /** @internal */
  public readCodec(schema: Schema, data: string | Uint8Array): any | Promise<any> {
    return this.codecDeserializer.read(schema, data);
  }
}
