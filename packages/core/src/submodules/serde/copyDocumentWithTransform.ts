import { ListSchema, MapSchema, StructureSchema } from "@smithy/core/schema";
import { SchemaRef } from "@smithy/types";

/**
 * @internal
 */
export const copyDocumentWithTransform = (
  source: any,
  schemaRef: SchemaRef,
  transform: (_: any, schemaRef: SchemaRef) => any = (_) => _
): any => {
  const schema = typeof schemaRef === "function" ? schemaRef() : schemaRef;
  switch (typeof source) {
    case "undefined":
    case "boolean":
    case "number":
    case "string":
    case "bigint":
    case "symbol":
      return transform(source, schema);
    case "function":
    case "object":
      if (source === null) {
        return transform(null, schema);
      }
      if (Array.isArray(source)) {
        const newArray = new Array(source.length);
        let i = 0;
        for (const item of source) {
          newArray[i++] = copyDocumentWithTransform(item, (schema as ListSchema)?.valueSchema, transform);
        }
        return transform(newArray, schema);
      }
      if ("byteLength" in (source as Uint8Array)) {
        const newBytes = new Uint8Array(source.byteLength);
        newBytes.set(source, 0);
        return transform(newBytes, schema);
      }
      if (source instanceof Date) {
        return transform(source, schema);
      }
      const newObject = {} as any;
      if (schema instanceof MapSchema) {
        for (const key of Object.keys(source)) {
          newObject[key] = copyDocumentWithTransform(source[key], schema.valueSchema, transform);
        }
      } else if (schema instanceof StructureSchema) {
        for (const key of Object.keys(source)) {
          newObject[key] = copyDocumentWithTransform(source[key], schema.members[key][0], transform);
        }
      } else {
        for (const key of Object.keys(source)) {
          newObject[key] = copyDocumentWithTransform(
            source[key],
            (schema as MapSchema)?.valueSchema ?? (schema as StructureSchema)?.members?.[key]?.[0],
            transform
          );
        }
      }

      return transform(newObject, schema);
    default:
      return transform(source, schema);
  }
};
