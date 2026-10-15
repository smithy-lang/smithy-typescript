import { NormalizedSchema } from "@smithy/core/schema";
import { LazyJsonString, dateToUtcString, generateIdempotencyToken, quoteHeader, toBase64 } from "@smithy/core/serde";
import type {
  CodecSettings,
  Schema,
  ShapeSerializer,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

import { HttpBindingValueKind, type HttpBindingValueMetadata } from "../HttpBindingSchemaExtension";
import { SerdeContext } from "../SerdeContext";
import { determineTimestampFormat, type HttpBindingValueLocation } from "./determineTimestampFormat";

/**
 * Serializes a shape to string.
 *
 * @public
 */
export class ToStringShapeSerializer extends SerdeContext implements ShapeSerializer<string> {
  private stringBuffer = "";

  public constructor(private settings: CodecSettings) {
    super();
  }

  public write(schema: Schema, value: unknown): void {
    const ns = NormalizedSchema.of(schema);
    const traits = ns.getMergedTraits();
    const location =
      typeof traits.httpPrefixHeaders === "string" || traits.httpHeader
        ? "header"
        : traits.httpLabel
          ? "label"
          : traits.httpQuery
            ? "query"
            : undefined;
    this.writeHttpBinding(ns, value, location);
  }

  /**
   * Writes a value using an already-resolved HTTP binding location.
   *
   * @internal
   */
  public writeHttpBinding(
    schema: Schema,
    value: unknown,
    location: HttpBindingValueLocation | undefined,
    metadata?: HttpBindingValueMetadata
  ): void {
    if (metadata) {
      this.writeCachedHttpBinding(schema, value, location, metadata);
      return;
    }

    const ns = NormalizedSchema.of(schema);
    switch (typeof value) {
      case "object":
        if (value === null) {
          this.stringBuffer = "null";
          return;
        }
        if (ns.isTimestampSchema()) {
          if (!(value instanceof Date)) {
            this.throwInvalidTimestamp(schema, value);
          }
          this.writeTimestamp(value, determineTimestampFormat(ns, this.settings, location));
          return;
        }
        if (ns.isBlobSchema() && "byteLength" in (value as Uint8Array)) {
          this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value as Uint8Array);
          return;
        }
        if (ns.isListSchema() && Array.isArray(value)) {
          let buffer = "";
          for (const item of value) {
            this.writeHttpBinding([ns.getValueSchema(), ns.getMergedTraits()], item, location);
            const headerItem = this.flush();
            const serialized = ns.getValueSchema().isTimestampSchema() ? headerItem : quoteHeader(headerItem);
            if (buffer !== "") {
              buffer += ", ";
            }
            buffer += serialized;
          }
          this.stringBuffer = buffer;
          return;
        }
        this.stringBuffer = JSON.stringify(value, null, 2);
        break;
      case "string":
        const mediaType = ns.getMergedTraits().mediaType;
        let intermediateValue: string | LazyJsonString = value;
        if (mediaType) {
          const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
          if (isJson) {
            intermediateValue = LazyJsonString.from(intermediateValue);
          }
          if (location === "header") {
            this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
            return;
          }
        }
        this.stringBuffer = value;
        break;
      default:
        if (ns.isIdempotencyToken()) {
          this.stringBuffer = generateIdempotencyToken();
        } else {
          this.stringBuffer = String(value);
        }
    }
  }

  private writeCachedHttpBinding(
    schema: Schema,
    value: unknown,
    location: HttpBindingValueLocation | undefined,
    metadata: HttpBindingValueMetadata
  ): void {
    switch (typeof value) {
      case "object":
        if (value === null) {
          this.stringBuffer = "null";
          return;
        }
        if (metadata.kind === HttpBindingValueKind.TIMESTAMP) {
          if (!(value instanceof Date)) {
            this.throwInvalidTimestamp(schema, value);
          }
          this.writeTimestamp(
            value,
            metadata.timestampFormat ?? determineTimestampFormat(NormalizedSchema.of(schema), this.settings, location)
          );
          return;
        }
        if (metadata.kind === HttpBindingValueKind.BLOB && "byteLength" in (value as Uint8Array)) {
          this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value as Uint8Array);
          return;
        }
        if (metadata.kind === HttpBindingValueKind.LIST && Array.isArray(value)) {
          let buffer = "";
          for (const item of value) {
            this.writeHttpBinding(metadata.listValueSchema!, item, location, metadata.listValueMetadata);
            const headerItem = this.flush();
            const serialized =
              metadata.listValueMetadata?.kind === HttpBindingValueKind.TIMESTAMP
                ? headerItem
                : quoteHeader(headerItem);
            if (buffer !== "") {
              buffer += ", ";
            }
            buffer += serialized;
          }
          this.stringBuffer = buffer;
          return;
        }
        this.stringBuffer = JSON.stringify(value, null, 2);
        return;
      case "string":
        let intermediateValue: string | LazyJsonString = value;
        if (metadata.mediaType) {
          if (metadata.isJsonMediaType) {
            intermediateValue = LazyJsonString.from(intermediateValue);
          }
          if (location === "header") {
            this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
            return;
          }
        }
        this.stringBuffer = value;
        return;
      default:
        this.stringBuffer = metadata.idempotencyToken ? generateIdempotencyToken() : String(value);
    }
  }

  private writeTimestamp(
    value: Date,
    format: TimestampDateTimeSchema | TimestampHttpDateSchema | TimestampEpochSecondsSchema
  ): void {
    switch (format) {
      case 5 satisfies TimestampDateTimeSchema:
        this.stringBuffer = value.toISOString().replace(".000Z", "Z");
        break;
      case 6 satisfies TimestampHttpDateSchema:
        this.stringBuffer = dateToUtcString(value);
        break;
      case 7 satisfies TimestampEpochSecondsSchema:
        this.stringBuffer = String(value.getTime() / 1000);
        break;
      default:
        console.warn("Missing timestamp format, using epoch seconds", value);
        this.stringBuffer = String(value.getTime() / 1000);
    }
  }

  private throwInvalidTimestamp(schema: Schema, value: object): never {
    const name = NormalizedSchema.of(schema).getName(true);
    throw new Error(`@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${name}`);
  }

  public flush(): string {
    const buffer = this.stringBuffer;
    this.stringBuffer = "";
    return buffer;
  }
}
