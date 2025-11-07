import { NormalizedSchema } from "@smithy/core/schema";
import type { CodecSettings, Schema, SerdeFunctions, ShapeDeserializer } from "@smithy/types";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

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
    const toString = this.serdeContext?.utf8Encoder ?? toUtf8;

    if (traits.httpHeader || traits.httpResponseCode) {
      return this.stringDeserializer.read(ns, toString(data));
    }
    if (traits.httpPayload) {
      if (ns.isBlobSchema()) {
        const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8;
        if (typeof data === "string") {
          return toBytes(data);
        }
        return data;
      } else if (ns.isStringSchema()) {
        if ("byteLength" in (data as Uint8Array)) {
          return toString(data);
        }
        return data;
      }
    }
    return this.codecDeserializer.read(ns, data);
  }
}
