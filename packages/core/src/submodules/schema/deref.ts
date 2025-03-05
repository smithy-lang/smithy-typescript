import { Schema, SchemaRef } from "@smithy/types";

/**
 * Dereferences a Schema pointer fn if needed.
 * @internal
 */
export const deref = (schemaRef: SchemaRef): Schema => {
  if (typeof schemaRef === "function") {
    return schemaRef();
  }
  return schemaRef;
};
