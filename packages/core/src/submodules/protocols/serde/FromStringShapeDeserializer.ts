import { NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
import { NumericValue,parseRfc3339DateTimeWithOffset, splitHeader } from "@smithy/core/serde";
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
    if (schema === 0b0001_0101 || schema === 0b0010_1010) {
      return fromBase64(data);
    }
    if (schema === 0b0000_0100) {
      return this.defaultTimestampParser(data);
    }
    if (schema === 0b0000_0101) {
      return parseRfc3339DateTimeWithOffset(data);
    }
    switch (true) {
      case ns.isNumericSchema():
        return Number(data);
      case ns.isBigIntegerSchema():
        return BigInt(data);
      case ns.isBigDecimalSchema():
        return new NumericValue(data, "bigDecimal");
      case ns.isBooleanSchema():
        return String(data).toLowerCase() === "true";
    }
    return data;
  }
}
