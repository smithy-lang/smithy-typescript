import { SerdeContext } from "@smithy/core/protocols";
import { NormalizedSchema } from "@smithy/core/schema";
import { _parseEpochTimestamp, fromBase64, generateIdempotencyToken } from "@smithy/core/serde";
import type { DocumentSchema, Schema, ShapeSerializer } from "@smithy/types";

import { cbor } from "../cbor";
import { dateToTag } from "../parseCborBody";

/**
 * @public
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
        for (const key in sourceObject) {
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
        const isUnion = ns.isUnionSchema();
        if (isUnion && Array.isArray(sourceObject.$unknown)) {
          const [k, v] = sourceObject.$unknown;
          newObject[k] = v;
        } else if (typeof sourceObject.__type === "string") {
          // This if-block is for backwards compatibility support and should not be copied
          // to other implementations.
          for (const k in sourceObject) {
            if (!(k in newObject)) {
              // we have no type information, so serialize with Document rules.
              newObject[k] = this.serialize(15 satisfies DocumentSchema, sourceObject[k]);
            }
          }
        }
      } else if (ns.isDocumentSchema()) {
        for (const key in sourceObject) {
          newObject[key] = this.serialize(ns.getValueSchema(), sourceObject[key]);
        }
      } else if (ns.isBigDecimalSchema()) {
        return sourceObject;
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
