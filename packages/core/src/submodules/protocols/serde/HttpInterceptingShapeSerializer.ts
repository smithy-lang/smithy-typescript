import { NormalizedSchema } from "@smithy/core/schema";
import { CodecSettings, Schema as ISchema, SerdeFunctions, ShapeSerializer } from "@smithy/types";

import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

export class HttpInterceptingShapeSerializer<CodecShapeSerializer extends ShapeSerializer<any>>
  implements ShapeSerializer<string | Uint8Array>
{
  private buffer: string | undefined;

  public constructor(
    private codecSerializer: CodecShapeSerializer,
    codecSettings: CodecSettings,
    private stringSerializer = new ToStringShapeSerializer(codecSettings)
  ) {}

  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.codecSerializer.setSerdeContext(serdeContext);
    this.stringSerializer.setSerdeContext(serdeContext);
  }

  public write(schema: ISchema, value: unknown): void {
    const ns = NormalizedSchema.of(schema);
    const traits = ns.getMergedTraits();
    if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
      this.stringSerializer.write(ns, value);
      this.buffer = this.stringSerializer.flush();
      return;
    }
    return this.codecSerializer.write(ns, value);
  }

  public flush(): string | Uint8Array {
    if (this.buffer !== undefined) {
      const buffer = this.buffer;
      this.buffer = undefined;
      return buffer;
    }
    return this.codecSerializer.flush();
  }
}
