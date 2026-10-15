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

import { HttpBindingValueKind, type HttpBindingValueMetadata } from "../HttpBindingSchemaExtension";
import { SerdeContext } from "../SerdeContext";
import { determineTimestampFormat, type HttpBindingValueLocation } from "./determineTimestampFormat";

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
    const traits = ns.getMergedTraits();
    const location =
      typeof traits.httpPrefixHeaders === "string" || traits.httpHeader
        ? "header"
        : traits.httpLabel
          ? "label"
          : traits.httpQuery
            ? "query"
            : undefined;
    return this.readHttpBinding(ns, data, location);
  }

  /**
   * Reads a value using an already-resolved HTTP binding location.
   *
   * @internal
   */
  public readHttpBinding(
    schema: Schema,
    data: string,
    location: HttpBindingValueLocation | undefined,
    metadata?: HttpBindingValueMetadata
  ): any {
    if (metadata) {
      return this.readCachedHttpBinding(schema, data, location, metadata);
    }

    const ns = NormalizedSchema.of(schema);
    if (ns.isListSchema()) {
      return splitHeader(data).map((item) => this.readHttpBinding(ns.getValueSchema(), item, location));
    }

    if (ns.isBlobSchema()) {
      return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
    }

    if (ns.isTimestampSchema()) {
      const format = determineTimestampFormat(ns, this.settings, location);

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
        if (location === "header") {
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

  private readCachedHttpBinding(
    schema: Schema,
    data: string,
    location: HttpBindingValueLocation | undefined,
    metadata: HttpBindingValueMetadata
  ): any {
    switch (metadata.kind) {
      case HttpBindingValueKind.LIST:
        return splitHeader(data).map((item) =>
          this.readHttpBinding(metadata.listValueSchema!, item, location, metadata.listValueMetadata)
        );
      case HttpBindingValueKind.BLOB:
        return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
      case HttpBindingValueKind.TIMESTAMP:
        return this.readTimestamp(
          data,
          metadata.timestampFormat ?? determineTimestampFormat(NormalizedSchema.of(schema), this.settings, location)
        );
      case HttpBindingValueKind.STRING:
        if (metadata.mediaType) {
          let intermediateValue: string | LazyJsonString = data;
          if (location === "header") {
            intermediateValue = this.base64ToUtf8(intermediateValue);
          }
          return metadata.isJsonMediaType ? LazyJsonString.from(intermediateValue) : intermediateValue;
        }
        return data;
      case HttpBindingValueKind.NUMBER:
        return Number(data);
      case HttpBindingValueKind.BIG_INTEGER:
        return BigInt(data);
      case HttpBindingValueKind.BIG_DECIMAL:
        return new NumericValue(data, "bigDecimal");
      case HttpBindingValueKind.BOOLEAN:
        return String(data).toLowerCase() === "true";
      default:
        return data;
    }
  }

  private readTimestamp(
    data: string,
    format: TimestampDateTimeSchema | TimestampHttpDateSchema | TimestampEpochSecondsSchema
  ): Date | undefined {
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

  private base64ToUtf8(base64String: string): any {
    return (this.serdeContext?.utf8Encoder ?? toUtf8)((this.serdeContext?.base64Decoder ?? fromBase64)(base64String));
  }
}
