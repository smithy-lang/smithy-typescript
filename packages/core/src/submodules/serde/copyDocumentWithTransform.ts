import { NormalizedSchema } from "@smithy/core/schema";
import { SchemaRef } from "@smithy/types";

/**
 * @internal
 */
export const copyDocumentWithTransform = (
  source: any,
  schemaRef: SchemaRef,
  transform: (_: any, schemaRef: SchemaRef) => any = (_) => _
): any => {
  const ns = NormalizedSchema.of(schemaRef);
  switch (typeof source) {
    case "undefined":
    case "boolean":
    case "number":
    case "string":
    case "bigint":
    case "symbol":
      return transform(source, ns);
    case "function":
    case "object":
      if (source === null) {
        return transform(null, ns);
      }
      if (Array.isArray(source)) {
        const newArray = new Array(source.length);
        let i = 0;
        for (const item of source) {
          newArray[i++] = copyDocumentWithTransform(item, ns.getValueSchema(), transform);
        }
        return transform(newArray, ns);
      }
      if ("byteLength" in (source as Uint8Array)) {
        const newBytes = new Uint8Array(source.byteLength);
        newBytes.set(source, 0);
        return transform(newBytes, ns);
      }
      if (source instanceof Date) {
        return transform(source, ns);
      }
      const newObject = {} as any;
      if (ns.isMapSchema()) {
        for (const key of Object.keys(source)) {
          newObject[key] = copyDocumentWithTransform(source[key], ns.getValueSchema(), transform);
        }
      } else if (ns.isStructSchema()) {
        for (const [key, memberSchema] of Object.entries(ns.getMemberSchemas())) {
          newObject[key] = copyDocumentWithTransform(source[key], memberSchema, transform);
        }
      } else if (ns.isDocumentSchema()) {
        for (const key of Object.keys(source)) {
          newObject[key] = copyDocumentWithTransform(source[key], ns.getValueSchema(), transform);
        }
      }

      return transform(newObject, ns);
    default:
      return transform(source, ns);
  }
};
