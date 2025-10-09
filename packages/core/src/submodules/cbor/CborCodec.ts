import { SerdeContext } from "@smithy/core/protocols";
import { NormalizedSchema } from "@smithy/core/schema";
import { _parseEpochTimestamp, generateIdempotencyToken } from "@smithy/core/serde";
import type { Codec, Schema, ShapeDeserializer, ShapeSerializer } from "@smithy/types";
import { fromBase64 } from "@smithy/util-base64";

import { cbor } from "./cbor";
import { dateToTag } from "./parseCborBody";

/**
 * @alpha
 */
export class CborCodec extends SerdeContext implements Codec<Uint8Array, Uint8Array> {
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
}

/**
 * @alpha
 */
export class CborShapeSerializer extends SerdeContext implements ShapeSerializer {
  private value: unknown;

  public write(schema: Schema, value: unknown): void {
    this.value = this.serialize(schema, value);
  }

  /**
   * Recursive serializer transform that copies and prepares the user input object
   * for CBOR serialization.
   */
  public serialize(schema: Schema, source: unknown): any {
    const ns = NormalizedSchema.of(schema);

    if (source == null) {
      if (ns.isIdempotencyToken()) {
        return generateIdempotencyToken();
      }
      return source as null | undefined;
    }

    if (ns.isBlobSchema()) {
      if (typeof source === "string") {
        return (this.serdeContext?.base64Decoder ?? fromBase64)(source);
      }
      return source as Uint8Array;
    }

    if (ns.isTimestampSchema()) {
      if (typeof source === "number" || typeof source === "bigint") {
        return dateToTag(new Date((Number(source) / 1000) | 0));
      }
      return dateToTag(source as Date);
    }

    if (typeof source === "function" || typeof source === "object") {
      const sourceObject = source as Record<string, unknown>;

      if (ns.isListSchema() && Array.isArray(sourceObject)) {
        const sparse = !!ns.getMergedTraits().sparse;
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
      if (sourceObject instanceof Date) {
        return dateToTag(sourceObject);
      }
      const newObject = {} as any;
      if (ns.isMapSchema()) {
        const sparse = !!ns.getMergedTraits().sparse;
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
          newObject[key] = this.serialize(ns.getValueSchema(), sourceObject[key]);
        }
      }
      return newObject;
    }

    return source;
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
export class CborShapeDeserializer extends SerdeContext implements ShapeDeserializer {
  public read(schema: Schema, bytes: Uint8Array): any {
    const data: any = cbor.deserialize(bytes);
    return this.readValue(schema, data);
  }

  /**
   * Public because it's called by the protocol implementation to deserialize errors.
   * @internal
   */
  public readValue(_schema: Schema, value: any): any {
    const ns = NormalizedSchema.of(_schema);

    if (ns.isTimestampSchema() && typeof value === "number") {
      // format is ignored.
      return _parseEpochTimestamp(value);
    }

    if (ns.isBlobSchema()) {
      if (typeof value === "string") {
        return (this.serdeContext?.base64Decoder ?? fromBase64)(value);
      }
      return value as Uint8Array | undefined;
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
        const newArray = [] as any[];
        const memberSchema = ns.getValueSchema();
        const sparse = !!ns.getMergedTraits().sparse;

        for (const item of value) {
          const itemValue = this.readValue(memberSchema, item);
          if (itemValue != null || sparse) {
            newArray.push(itemValue);
          }
        }
        return newArray;
      }

      const newObject = {} as any;

      if (ns.isMapSchema()) {
        const sparse = !!ns.getMergedTraits().sparse;
        const targetSchema = ns.getValueSchema();

        for (const key of Object.keys(value)) {
          const itemValue = this.readValue(targetSchema, value[key]);
          if (itemValue != null || sparse) {
            newObject[key] = itemValue;
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
