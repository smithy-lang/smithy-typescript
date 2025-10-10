import type { OperationSchema, SchemaRef, SchemaTraits } from "@smithy/types";

/**
 * Converts the static schema array into an object-form to adapt
 * to the signature of ClientProtocol classes.
 * @internal
 */
export const operation = (
  namespace: string,
  name: string,
  traits: SchemaTraits,
  input: SchemaRef,
  output: SchemaRef
): OperationSchema => ({
  name,
  namespace,
  traits,
  input,
  output,
});
