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
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  CodecSettings,
  ListSchemaModifier,
  NumericSchema,
  Schema,
  ShapeDeserializer,
  StreamingBlobSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

import {
  HttpBindingNormalizedSchema,
  type HttpBindingLocation,
  type HttpBindingValue,
} from "../HttpBindingNormalizedSchema";
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
    const ns = HttpBindingNormalizedSchema.of(_schema);
    const traits = ns.getMergedTraits();
    const location = ns.getHttpBindingLocation(traits);
    return this.readHttpBinding(ns.getHttpBindingValue(location, traits), data, location);
  }

  public readHttpBinding(
    [ns, flags, collectionValue]: HttpBindingValue,
    data: string,
    location: HttpBindingLocation
  ): any {
    const schema = flags & 0xff;
    if ((schema & 0b1100_0000) === (0b0100_0000 satisfies ListSchemaModifier)) {
      collectionValue ??= ns.getHttpBindingCollectionValue(location);
      return splitHeader(data).map((item) => this.readHttpBinding(collectionValue!, item, location));
    }

    switch (schema) {
      case 21 satisfies BlobSchema:
      case 42 satisfies StreamingBlobSchema:
        return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
      case 4 satisfies TimestampDefaultSchema:
      case 5 satisfies TimestampDateTimeSchema:
      case 6 satisfies TimestampHttpDateSchema:
      case 7 satisfies TimestampEpochSecondsSchema: {
        const bindingFormat = this.settings.httpBindings ? (flags >> 14) & 0b11 : 0;
        const format =
          this.settings.timestampFormat.useTrait && schema > (4 satisfies TimestampDefaultSchema)
            ? schema
            : bindingFormat
              ? bindingFormat + (4 satisfies TimestampDefaultSchema)
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
      case 0 satisfies StringSchema: {
        const media = (flags >> 8) & 0b11;
        if (!media) {
          return data;
        }
        let intermediateValue: string | LazyJsonString = data;
        if ((location & 0b110) === 0b110) {
          intermediateValue = (this.serdeContext?.utf8Encoder ?? toUtf8)(
            (this.serdeContext?.base64Decoder ?? fromBase64)(intermediateValue)
          );
        }
        return media === 2 ? LazyJsonString.from(intermediateValue) : intermediateValue;
      }
      case 1 satisfies NumericSchema:
        return Number(data);
      case 2 satisfies BooleanSchema:
        return data.toLowerCase() === "true";
      case 17 satisfies BigIntegerSchema:
        return BigInt(data);
      case 19 satisfies BigDecimalSchema:
        return new NumericValue(data, "bigDecimal");
      default:
        return data;
    }
  }
}
