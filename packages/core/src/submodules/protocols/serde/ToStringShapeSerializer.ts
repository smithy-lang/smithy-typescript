import { NormalizedSchema } from "@smithy/core/schema";
import { dateToUtcString, generateIdempotencyToken, LazyJsonString, quoteHeader } from "@smithy/core/serde";
import type {
  CodecSettings,
  Schema,
  ShapeSerializer,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";

import { SerdeContext } from "../SerdeContext";
import { determineTimestampFormat } from "./determineTimestampFormat";

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
    switch (typeof value) {
      case "object":
        if (value === null) {
          this.stringBuffer = "null";
          return;
        }
        if (ns.isTimestampSchema()) {
          if (!(value instanceof Date)) {
            throw new Error(
              `@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${ns.getName(
                true
              )}`
            );
          }
          const format = determineTimestampFormat(ns, this.settings);
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
        if (ns.isBlobSchema() && "byteLength" in (value as Uint8Array)) {
          this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value as Uint8Array);
          return;
        }
        if (ns.isListSchema() && Array.isArray(value)) {
          let buffer = "";
          for (const item of value) {
            this.write([ns.getValueSchema(), ns.getMergedTraits()], item);
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
          if (ns.getMergedTraits().httpHeader) {
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

  public flush(): string {
    const buffer = this.stringBuffer;
    this.stringBuffer = "";
    return buffer;
  }
}
