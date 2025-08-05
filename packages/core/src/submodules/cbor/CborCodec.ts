import { NormalizedSchema } from "@smithy/core/schema";
import { parseEpochTimestamp } from "@smithy/core/serde";
import { Codec, Schema, SerdeFunctions, ShapeDeserializer, ShapeSerializer } from "@smithy/types";

import { cbor } from "./cbor";
import { dateToTag } from "./parseCborBody";

/**
 * @alpha
 */
export class CborCodec implements Codec<Uint8Array, Uint8Array> {
  private serdeContext?: SerdeFunctions;

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

  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.serdeContext = serdeContext;
  }
}

/**
 * @alpha
 */
export class CborShapeSerializer implements ShapeSerializer {
  private serdeContext?: SerdeFunctions;
  private value: unknown;

  public setSerdeContext(serdeContext: SerdeFunctions) {
    this.serdeContext = serdeContext;
  }

  public write(schema: Schema, value: unknown): void {
    this.value = this.serialize(schema, value);
  }

  /**
   * Recursive serializer transform that copies and prepares the user input object
   * for CBOR serialization.
   */
  public serialize(schema: Schema, source: unknown): any {
    const ns = NormalizedSchema.of(schema);

    switch (typeof source) {
      case "undefined":
        return null;
      case "boolean":
      case "number":
      case "string":
      case "bigint":
      case "symbol":
        return source;
      case "function":
      case "object":
        if (source === null) {
          return null;
        }

        const sourceObject = source as Record<string, unknown>;
        const sparse = !!ns.getMergedTraits().sparse;

        if (ns.isListSchema() && Array.isArray(sourceObject)) {
          const newArray = [];
          let i = 0;
          for (const item of sourceObject) {
            const value = this.serialize(ns.getValueSchema(), item);
            if (value != null || sparse) {
              newArray[i++] = value;
            }
          }
          return newArray;
        }
        if (sourceObject instanceof Uint8Array) {
          const newBytes = new Uint8Array(sourceObject.byteLength);
          newBytes.set(sourceObject, 0);
          return newBytes;
        }
        if (sourceObject instanceof Date) {
          return dateToTag(sourceObject);
        }
        const newObject = {} as any;
        if (ns.isMapSchema()) {
          for (const key of Object.keys(sourceObject)) {
            const value = this.serialize(ns.getValueSchema(), sourceObject[key]);
            if (value != null || sparse) {
              newObject[key] = value;
            }
          }
        } else if (ns.isStructSchema()) {
          for (const [key, memberSchema] of ns.structIterator()) {
            const value = this.serialize(memberSchema, sourceObject[key]);
            if (value != null) {
              newObject[key] = value;
            }
          }
        } else if (ns.isDocumentSchema()) {
          for (const key of Object.keys(sourceObject)) {
            const value = this.serialize(ns.getValueSchema(), sourceObject[key]);
            if (value != null) {
              newObject[key] = value;
            }
          }
        }
        return newObject;
      default:
        return source;
    }
  }

  public flush(): Uint8Array {
    const buffer = cbor.serialize(this.value);
    this.value = undefined;
    return buffer as Uint8Array;
  }
}

/**
 * @alpha
 */
export class CborShapeDeserializer implements ShapeDeserializer {
  private serdeContext?: SerdeFunctions;

  public setSerdeContext(serdeContext: SerdeFunctions) {
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

    if (
      typeof value === "undefined" ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "bigint" ||
      typeof value === "symbol"
    ) {
      return value;
    } else if (typeof value === "function" || typeof value === "object") {
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
        for (const [key, memberSchema] of ns.structIterator()) {
          newObject[key] = this.readValue(memberSchema, value[key]);
        }
      }
      return newObject;
    } else {
      return value;
    }
  }
}
