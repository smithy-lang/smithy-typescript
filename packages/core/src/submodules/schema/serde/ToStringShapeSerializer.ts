import { quoteHeader } from "@smithy/core/serde";
import { Schema, ShapeSerializer } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";

/**
 * Serializes a shape to string.
 */
export class ToStringShapeSerializer implements ShapeSerializer<string> {
  private stringBuffer = "";

  public write(schema: Schema, value: unknown): void {
    switch (typeof value) {
      case "object":
        if (value === null) {
          this.stringBuffer = "null";
          return;
        }
        if ("byteLength" in (value as Uint8Array)) {
          this.stringBuffer = toBase64(value as Uint8Array);
          return;
        }
        if (value instanceof Date) {
          this.stringBuffer = (value as Date).toISOString();
          return;
        }
        if (Array.isArray(value)) {
          this.stringBuffer = value.map(quoteHeader).join(",");
          return;
        }
        this.stringBuffer = JSON.stringify(value, null, 2);
        break;
      default:
        this.stringBuffer = String(value);
    }
  }
  public flush(): string {
    const buffer = this.stringBuffer;
    this.stringBuffer = "";
    return buffer;
  }
}
