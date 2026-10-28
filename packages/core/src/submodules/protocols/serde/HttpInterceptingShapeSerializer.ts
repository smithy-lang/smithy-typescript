import type {
  CodecSettings,
  ConfigurableSerdeContext,
  Schema as ISchema,
  SerdeFunctions,
  ShapeSerializer,
} from "@smithy/types";

import {
  HttpBindingNormalizedSchema,
  type HttpBindingLocation,
  type HttpBindingValue,
} from "../HttpBindingNormalizedSchema";
import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

/**
 * This serializer decides whether to dispatch to a string serializer or a codec serializer
 * depending on HTTP binding traits within the given schema.
 *
 * For example, a JavaScript array is serialized differently when being written
 * to a REST JSON HTTP header (comma-delimited string) and a REST JSON HTTP body (JSON array).
 *
 * @public
 */
export class HttpInterceptingShapeSerializer<CodecShapeSerializer extends ShapeSerializer<string | Uint8Array>>
  implements ShapeSerializer<string | Uint8Array>, ConfigurableSerdeContext
{
  private buffer: string | undefined;

  public constructor(
    private codecSerializer: CodecShapeSerializer,
    codecSettings: CodecSettings,
    private stringSerializer = new ToStringShapeSerializer(codecSettings)
  ) {}

  /**
   * @override
   */
  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.codecSerializer.setSerdeContext(serdeContext);
    this.stringSerializer.setSerdeContext(serdeContext);
  }

  public write(schema: ISchema, value: unknown): void {
    const ns = HttpBindingNormalizedSchema.of(schema);
    const traits = ns.getMergedTraits();
    if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
      const location = ns.getHttpBindingLocation(traits);
      this.writeHttpBinding(ns.getHttpBindingValue(location, traits), value, location);
      return;
    }
    this.writeCodec(ns, value);
  }

  public writeHttpBinding(binding: HttpBindingValue, value: unknown, location: HttpBindingLocation): void {
    this.stringSerializer.writeHttpBinding(binding, value, location);
    this.buffer = this.stringSerializer.flush();
  }

  public writeCodec(schema: ISchema, value: unknown): void {
    this.codecSerializer.write(schema, value);
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
