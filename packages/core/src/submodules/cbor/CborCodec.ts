import { NormalizedSchema } from "@smithy/core/schema";
import { copyDocumentWithTransform, parseEpochTimestamp } from "@smithy/core/serde";
import { Codec, Schema, SchemaRef, SerdeContext, ShapeDeserializer, ShapeSerializer } from "@smithy/types";

import { cbor } from "./cbor";
import { dateToTag } from "./parseCborBody";

export class CborCodec implements Codec<Uint8Array, Uint8Array> {
  private serdeContext?: SerdeContext;

  public createSerializer(): CborShapeSerializer {
    const serializer = new CborShapeSerializer();
    serializer.setSerdeContext(this.serdeContext!);
    return serializer;
  }

  public createDeserializer(): CborShapeDeserializer {
    const deserializer = new CborShapeDeserializer();
    deserializer.setSerdeContext(this.serdeContext!);
    return deserializer;
  }

  public setSerdeContext(serdeContext: SerdeContext): void {
    this.serdeContext = serdeContext;
  }
}

export class CborShapeSerializer implements ShapeSerializer<Uint8Array> {
  private serdeContext?: SerdeContext;
  private value: unknown;

  public setSerdeContext(serdeContext: SerdeContext) {
    this.serdeContext = serdeContext;
  }

  public write(schema: Schema, value: unknown): void {
    this.value = copyDocumentWithTransform(value, schema, (_: any, schemaRef: SchemaRef) => {
      if (_ instanceof Date) {
        return dateToTag(_);
      }
      if (_ instanceof Uint8Array) {
        return _;
      }

      const ns = NormalizedSchema.of(schemaRef);
      const sparse = !!ns.getMergedTraits().sparse;

      if (Array.isArray(_)) {
        if (!sparse) {
          return _.filter((item) => item != null);
        }
      } else if (_ && typeof _ === "object") {
        if (!sparse || ns.isStructSchema()) {
          for (const [k, v] of Object.entries(_)) {
            if (v == null) {
              delete _[k];
            }
          }
          return _;
        }
      }

      return _;
    });
  }

  public flush(): Uint8Array {
    const buffer = cbor.serialize(this.value);
    this.value = undefined;
    return buffer as Uint8Array;
  }
}

export class CborShapeDeserializer implements ShapeDeserializer {
  private serdeContext?: SerdeContext;

  public setSerdeContext(serdeContext: SerdeContext) {
    this.serdeContext = serdeContext;
  }

  public read(schema: Schema, bytes: Uint8Array): any {
    const data: any = cbor.deserialize(bytes);
    return this.readValue(schema, data);
  }

  private readValue(_schema: Schema, value: any): any {
    const ns = NormalizedSchema.of(_schema);
    const schema = ns.getSchema();

    if (typeof schema === "number") {
      if (ns.isTimestampSchema()) {
        // format is ignored.
        return parseEpochTimestamp(value);
      }
      if (ns.isBlobSchema()) {
        return value;
      }
    }

    switch (typeof value) {
      case "undefined":
      case "boolean":
      case "number":
      case "string":
      case "bigint":
      case "symbol":
        return value;
      case "function":
      case "object":
        if (value === null) {
          return null;
        }
        if ("byteLength" in (value as Uint8Array)) {
          return value;
        }
        if (value instanceof Date) {
          return value;
        }
        if (ns.isDocumentSchema()) {
          return value;
        }

        if (ns.isListSchema()) {
          const newArray = [];
          const memberSchema = ns.getValueSchema();
          const sparse = ns.isListSchema() && !!ns.getMergedTraits().sparse;

          for (const item of value) {
            newArray.push(this.readValue(memberSchema, item));
            if (!sparse && newArray[newArray.length - 1] == null) {
              newArray.pop();
            }
          }
          return newArray;
        }

        const newObject = {} as any;

        if (ns.isMapSchema()) {
          const sparse = ns.getMergedTraits().sparse;
          const targetSchema = ns.getValueSchema();

          for (const key of Object.keys(value)) {
            newObject[key] = this.readValue(targetSchema, value[key]);

            if (newObject[key] == null && !sparse) {
              delete newObject[key];
            }
          }
        } else if (ns.isStructSchema()) {
          for (const key of Object.keys(value)) {
            const targetSchema = ns.getMemberSchema(key);
            if (targetSchema === undefined) {
              continue;
            }
            newObject[key] = this.readValue(targetSchema, value[key]);
          }
        }
        return newObject;
      default:
        return value;
    }
  }
}
