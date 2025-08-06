import { SchemaRef } from "@smithy/types";

/**
 * @internal
 * @deprecated the former functionality has been internalized to the CborCodec.
 */
export const copyDocumentWithTransform = (
  source: any,
  schemaRef: SchemaRef,
  transform: (_: any, schemaRef: SchemaRef) => any = (_) => _
): any => source;
