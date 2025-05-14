import type { Schema, SchemaRef } from "@smithy/types";

/**
 * Dereferences a SchemaRef if needed.
 * @internal
 */
export const deref = (schemaRef: SchemaRef): Schema => {
  if (typeof schemaRef === "function") {
    return schemaRef();
  }
  return schemaRef;
};
