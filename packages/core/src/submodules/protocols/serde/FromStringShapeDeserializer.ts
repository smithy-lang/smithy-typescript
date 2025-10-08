import { NormalizedSchema } from "@smithy/core/schema";
import {
  _parseEpochTimestamp,
  _parseRfc3339DateTimeWithOffset,
  _parseRfc7231DateTime,
  LazyJsonString,
  NumericValue,
  splitHeader,
} from "@smithy/core/serde";
import type {
  CodecSettings,
  Schema,
  SerdeFunctions,
  ShapeDeserializer,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";
import { fromBase64 } from "@smithy/util-base64";
import { toUtf8 } from "@smithy/util-utf8";

import { determineTimestampFormat } from "./determineTimestampFormat";

/**
 * This deserializer reads strings.
 *
 * @alpha
 */
export class FromStringShapeDeserializer implements ShapeDeserializer<string> {
  private serdeContext: SerdeFunctions | undefined;

  public constructor(private settings: CodecSettings) {}

  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.serdeContext = serdeContext;
  }

  public read(_schema: Schema, data: string): any {
    const ns = NormalizedSchema.of(_schema);

    if (ns.isListSchema()) {
      return splitHeader(data).map((item) => this.read(ns.getValueSchema(), item));
    }

    if (ns.isBlobSchema()) {
      return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
    }

    if (ns.isTimestampSchema()) {
      const format = determineTimestampFormat(ns, this.settings);

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

    if (ns.isStringSchema()) {
      const mediaType = ns.getMergedTraits().mediaType;
      let intermediateValue: string | LazyJsonString = data;
      if (mediaType) {
        if (ns.getMergedTraits().httpHeader) {
          intermediateValue = this.base64ToUtf8(intermediateValue);
        }
        const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
        if (isJson) {
          intermediateValue = LazyJsonString.from(intermediateValue);
        }
        return intermediateValue;
      }
    }

    if (ns.isNumericSchema()) {
      return Number(data);
    }
    if (ns.isBigIntegerSchema()) {
      return BigInt(data);
    }
    if (ns.isBigDecimalSchema()) {
      return new NumericValue(data, "bigDecimal");
    }
    if (ns.isBooleanSchema()) {
      return String(data).toLowerCase() === "true";
    }
    return data;
  }

  private base64ToUtf8(base64String: string): any {
    return (this.serdeContext?.utf8Encoder ?? toUtf8)((this.serdeContext?.base64Decoder ?? fromBase64)(base64String));
  }
}
