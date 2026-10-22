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

import {
  getHttpBindingLocation,
  getHttpBindingValue,
  type HttpBindingLocation,
  type HttpBindingValue,
} from "../HttpBindingSchemaExtension";
import { SerdeContext } from "../SerdeContext";

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
    const location = getHttpBindingLocation(traits);
    this.writeHttpBinding(getHttpBindingValue(ns, location, traits), value, location);
  }

  /** @internal */
  public writeHttpBinding(
    [ns, flags, collectionValue]: HttpBindingValue,
    value: unknown,
    location: HttpBindingLocation
  ) {
    const schema = flags & 0xff;
    switch (typeof value) {
      case "object":
        if (value === null) {
          this.stringBuffer = "null";
          return;
        }
        if (schema >= 4 && schema <= 7) {
          if (!(value instanceof Date)) {
            throw new Error(
              `@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${ns.getName(
                true
              )}`
            );
          }
          const bindingFormat = (flags >> 14) & 0b11;
          const format =
            this.settings.timestampFormat.useTrait && schema > 4
              ? schema
              : bindingFormat
                ? bindingFormat + 4
                : this.settings.timestampFormat.default;
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
          return;
        }
        if ((schema === 21 || schema === 42) && "byteLength" in (value as Uint8Array)) {
          this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value as Uint8Array);
          return;
        }
        if ((schema & 0b1100_0000) === 0b0100_0000 && Array.isArray(value)) {
          const valueSchemaType = collectionValue![1] & 0xff;
          const isTimestamp = valueSchemaType >= 4 && valueSchemaType <= 7;
          let buffer = "";
          for (const item of value) {
            this.writeHttpBinding(collectionValue!, item, location);
            const headerItem = this.flush();
            if (buffer) buffer += ", ";
            buffer += isTimestamp ? headerItem : quoteHeader(headerItem);
          }
          this.stringBuffer = buffer;
          return;
        }
        this.stringBuffer = JSON.stringify(value, null, 2);
        break;
      case "string":
        const media = (flags >> 8) & 0b11;
        let intermediateValue: string | LazyJsonString = value;
        if (media === 2) intermediateValue = LazyJsonString.from(intermediateValue);
        if (media && (location & 0b110) === 0b110) {
          this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
          return;
        }
        this.stringBuffer = value;
        break;
      default:
        this.stringBuffer = (flags >> 10) & 1 ? generateIdempotencyToken() : String(value);
    }
  }

  public flush(): string {
    const buffer = this.stringBuffer;
    this.stringBuffer = "";
    return buffer;
  }
}
