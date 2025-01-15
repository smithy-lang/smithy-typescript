import { deref, ListSchema, MapSchema, StructureSchema } from "@smithy/core/schema";
import { copyDocumentWithTransform, parseEpochTimestamp } from "@smithy/core/serde";
import {
  Codec,
  MemberSchema,
  Schema,
  SchemaRef,
  ShapeDeserializer,
  ShapeSerializer,
  TraitsSchema,
} from "@smithy/types";

import { cbor } from "./cbor";
import { dateToTag } from "./parseCborBody";

export class CborCodec implements Codec<Uint8Array> {
  public createSerializer(): CborShapeSerializer {
    return new CborShapeSerializer();
  }
  public createDeserializer(): CborShapeDeserializer {
    return new CborShapeDeserializer();
  }
}

export class CborShapeSerializer implements ShapeSerializer<Uint8Array> {
  private value: unknown;

  public write(schema: Schema, value: unknown): void {
    this.value = copyDocumentWithTransform(value, schema, (_: any, schemaRef: SchemaRef) => {
      if (_ instanceof Date) {
        return dateToTag(_);
      }
      const schema = deref((schemaRef as MemberSchema)?.[0] ?? schemaRef);
      if (_ instanceof Uint8Array) {
        return _;
      }
      const sparse = (schema as TraitsSchema)?.traits?.sparse;
      if (Array.isArray(_)) {
        if (!sparse) {
          return _.filter((item) => item != null);
        }
      } else if (_ && typeof _ === "object") {
        if (!sparse) {
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
  public read(schema: Schema, bytes: Uint8Array): any {
    const data: any = cbor.deserialize(bytes);
    return this.readValue(schema, data);
  }

  private readValue(schema: Schema, value: any): any {
    if (typeof schema === "string") {
      if (schema === "time" || schema === "epoch-seconds" || schema === "date-time") {
        return parseEpochTimestamp(value);
      }
      if (schema === "blob") {
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
        const traits =
          Array.isArray(schema) && schema.length >= 2
            ? {
                ...(deref((schema as MemberSchema)[0]) as TraitsSchema)?.traits,
                ...(schema as MemberSchema)[1],
              }
            : (deref(schema) as TraitsSchema)?.traits;

        if (Array.isArray(value)) {
          const newArray = [];
          for (const item of value) {
            newArray.push(this.readValue(schema instanceof ListSchema ? deref(schema.valueSchema) : void 0, item));
            if (!traits?.sparse) {
              if (newArray[newArray.length - 1] == null) {
                newArray.pop();
              }
            }
          }
          return newArray;
        }

        const newObject = {} as any;
        for (const key of Object.keys(value)) {
          const targetSchema =
            schema instanceof StructureSchema
              ? deref(schema.members[key]?.[0])
              : schema instanceof MapSchema
                ? deref(schema.valueSchema)
                : void 0;
          newObject[key] = this.readValue(targetSchema, value[key]);
          if (!traits?.sparse && newObject[key] == null) {
            delete newObject[key];
          }
        }
        return newObject;
      default:
        return value;
    }
  }

  public getContainerSize(): number {
    throw new Error("Method not implemented.");
  }
}
