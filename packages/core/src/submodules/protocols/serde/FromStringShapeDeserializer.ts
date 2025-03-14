import { NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
import { parseRfc3339DateTimeWithOffset, splitHeader } from "@smithy/core/serde";
import { Schema, SerdeContext, ShapeDeserializer } from "@smithy/types";
import { fromBase64 } from "@smithy/util-base64";

export class FromStringShapeDeserializer implements ShapeDeserializer<string> {
  private serdeContext?: SerdeContext;

  public constructor(
    private registry: TypeRegistry,
    private defaultTimestampParser: (time: string) => Date
  ) {}

  public setSerdeContext(serdeContext: SerdeContext): void {
    this.serdeContext = serdeContext;
  }

  public read(_schema: Schema, data: string): any {
    const ns = NormalizedSchema.of(_schema);
    const schema = ns.getSchema();
    if (ns.isListSchema()) {
      return splitHeader(data);
    }
    if (schema === "blob" || schema === "streaming-blob") {
      return fromBase64(data);
    }
    if (schema === "time") {
      return this.defaultTimestampParser(data);
    }
    if (schema === "date-time") {
      return parseRfc3339DateTimeWithOffset(data);
    }
    const simpleType = this.registry.getSimpleType(ns.getName() ?? "");
    switch (simpleType) {
      case "number":
        return Number(data);
      case "bigint":
        return BigInt(data);
      case "bigdecimal":
        // todo(schema)
        throw new Error("bigdecimal not implemented");
      case "boolean":
        return String(data).toLowerCase() === "true";
    }
    return data;
  }
}
