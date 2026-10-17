import { NormalizedSchema } from "@smithy/core/schema";
import {
  LazyJsonString,
  NumericValue,
  _parseEpochTimestamp,
  _parseRfc3339DateTimeWithOffset,
  _parseRfc7231DateTime,
  fromBase64,
  splitHeader,
  toUtf8,
} from "@smithy/core/serde";
import type {
  CodecSettings,
  Schema,
  ShapeDeserializer,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

import { resolveHttpBinding, type HttpBindingLocation, type HttpBindingValue } from "../HttpBindingSchemaExtension";
import { SerdeContext } from "../SerdeContext";

/**
 * This deserializer reads strings.
 *
 * @public
 */
export class FromStringShapeDeserializer extends SerdeContext implements ShapeDeserializer<string> {
  public constructor(private settings: CodecSettings) {
    super();
  }

  public read(_schema: Schema, data: string): any {
    const ns = NormalizedSchema.of(_schema);
    const [location, binding] = resolveHttpBinding(ns);
    return this.readHttpBinding(binding, data, location);
  }

  /** @internal */
  public readHttpBinding(
    [, flags, collectionValue]: HttpBindingValue,
    data: string,
    location: HttpBindingLocation
  ): any {
    const schema = flags & 0xff;
    if ((schema & 0b1100_0000) === 0b0100_0000) {
      return splitHeader(data).map((item) => this.readHttpBinding(collectionValue!, item, location));
    }

    switch (schema) {
      case 21:
      case 42:
        return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
      case 4:
      case 5:
      case 6:
      case 7: {
        const bindingFormat = (flags >> 14) & 0b11;
        const format =
          this.settings.timestampFormat.useTrait && schema > 4
            ? schema
            : bindingFormat
              ? bindingFormat + 4
              : this.settings.timestampFormat.default;

        switch (format) {
          case 5 satisfies TimestampDateTimeSchema:
            return _parseRfc3339DateTimeWithOffset(data);
          case 6 satisfies TimestampHttpDateSchema:
            return _parseRfc7231DateTime(data);
          case 7 satisfies TimestampEpochSecondsSchema:
            return _parseEpochTimestamp(data);
          default:
            console.warn("Missing timestamp format, parsing value with Date constructor:", data);
            return new Date(data as string | number);
        }
      }
      case 0: {
        const media = (flags >> 8) & 0b11;
        if (!media) return data;
        let intermediateValue: string | LazyJsonString = data;
        if ((location & 0b110) === 0b110) {
          intermediateValue = this.base64ToUtf8(intermediateValue);
        }
        if (media === 2) {
          intermediateValue = LazyJsonString.from(intermediateValue);
        }
        return intermediateValue;
      }
      case 1:
        return Number(data);
      case 2:
        return String(data).toLowerCase() === "true";
      case 17:
        return BigInt(data);
      case 19:
        return new NumericValue(data, "bigDecimal");
      default:
        return data;
    }
  }

  private base64ToUtf8(base64String: string): any {
    return (this.serdeContext?.utf8Encoder ?? toUtf8)((this.serdeContext?.base64Decoder ?? fromBase64)(base64String));
  }
}
