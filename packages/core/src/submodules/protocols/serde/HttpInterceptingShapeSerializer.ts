import { NormalizedSchema } from "@smithy/core/schema";
import { Schema as ISchema, SerdeContext, ShapeSerializer } from "@smithy/types";

import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

export class HttpInterceptingShapeSerializer<CodecShapeSerializer extends ShapeSerializer<any>>
  implements ShapeSerializer<string | Uint8Array>
{
  private buffer: string | undefined;

  public constructor(
    private codecSerializer: CodecShapeSerializer,
    private stringSerializer = new ToStringShapeSerializer()
  ) {}

  public setSerdeContext(serdeContext: SerdeContext): void {
      this.codecSerializer.setSerdeContext(serdeContext);
      this.stringSerializer.setSerdeContext(serdeContext);
  }

  public write(schema: ISchema, value: unknown): void {
    const ns = NormalizedSchema.of(schema);
    if (ns.isMemberSchema()) {
      const targetSchema = ns.getSchema();
      const traits = ns.getMergedTraits();

      if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
        this.stringSerializer.write(targetSchema, value);
        this.buffer = this.stringSerializer.flush();
        return;
      }
    }
    return this.codecSerializer.write(schema, value);
  }

  public flush(): string | Uint8Array {
    if (this.buffer) {
      const buffer = this.buffer;
      this.buffer = undefined;
      return buffer;
    }
    return this.codecSerializer.flush();
  }
}
