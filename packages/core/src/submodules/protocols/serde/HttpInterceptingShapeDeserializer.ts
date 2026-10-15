import { NormalizedSchema } from "@smithy/core/schema";
import { fromUtf8, toUtf8 } from "@smithy/core/serde";
import type { CodecSettings, Schema, SerdeFunctions, ShapeDeserializer } from "@smithy/types";

import { HttpBindingValueKind, type HttpBindingValueMetadata } from "../HttpBindingSchemaExtension";
import { SerdeContext } from "../SerdeContext";
import { FromStringShapeDeserializer } from "./FromStringShapeDeserializer";
import type { HttpBindingValueLocation } from "./determineTimestampFormat";

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
      return this.readHttpBinding(ns, data, "header");
    }
    if (traits.httpPayload) {
      return this.readPayload(ns, data);
    }
    return this.readCodec(ns, data);
  }

  /**
   * Deserializes a value whose HTTP binding location has already been resolved.
   *
   * @internal
   */
  public readHttpBinding(
    schema: Schema,
    data: string | Uint8Array,
    location: HttpBindingValueLocation,
    metadata?: HttpBindingValueMetadata
  ): any {
    const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
    return this.stringDeserializer.readHttpBinding(schema, toString(data), location, metadata);
  }

  /**
   * Deserializes a non-streaming HTTP payload.
   *
   * @internal
   */
  public readPayload(
    schema: Schema,
    data: string | Uint8Array,
    metadata?: HttpBindingValueMetadata
  ): any | Promise<any> {
    if (metadata?.kind === HttpBindingValueKind.BLOB) {
      const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8;
      return typeof data === "string" ? toBytes(data) : data;
    }
    if (metadata?.kind === HttpBindingValueKind.STRING) {
      const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
      return typeof data === "string" ? data : toString(data);
    }

    const ns = NormalizedSchema.of(schema);
    if (ns.isBlobSchema()) {
      const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8;
      return typeof data === "string" ? toBytes(data) : data;
    }
    if (ns.isStringSchema()) {
      const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
      return typeof data === "string" ? data : toString(data);
    }
    return this.readCodec(ns, data);
  }

  /**
   * Deserializes a value directly with the payload codec.
   *
   * @internal
   */
  public readCodec(schema: Schema, data: string | Uint8Array): any | Promise<any> {
    return this.codecDeserializer.read(schema, data);
  }
}
