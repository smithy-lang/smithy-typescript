import { Schema as ISchema, ShapeSerializer } from "@smithy/types";

import { deref } from "./deref";
import { Schema } from "./schemas/Schema";
import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

export class HttpInterceptingShapeSerializer<CodecShapeSerializer extends ShapeSerializer>
  implements ShapeSerializer<string | Uint8Array>
{
  private buffer: Promise<string> | undefined;

  public constructor(
    private codecSerializer: CodecShapeSerializer,
    private stringSerializer = new ToStringShapeSerializer()
  ) {}

  public write(schema: ISchema, value: unknown): void {
    if (Schema.isMemberSchema(schema)) {
      const [targetSchema, traits] = [deref(schema[0]), schema[1]];
      if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
        this.stringSerializer.write(targetSchema, value);
        this.buffer = this.stringSerializer.flush();
        return;
      }
    }
    return this.codecSerializer.write(schema, value);
  }

  public async flush(): Promise<string | Uint8Array> {
    if (this.buffer) {
      const buffer = this.buffer;
      this.buffer = undefined;
      return buffer;
    }
    return this.codecSerializer.flush();
  }
}
