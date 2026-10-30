import { NormalizedSchema } from "@smithy/core/schema";
import type { SchemaRef } from "@smithy/types";

const SENSITIVE_STRING = "***SensitiveInformation***";

/**
 * Redacts sensitive parts of any data object using its schema, for logging.
 *
 * @internal
 * @param schema - with filtering traits.
 * @param data - to be logged.
 */
export function schemaLogFilter(schema: SchemaRef, data: unknown): any {
  if (data == null) {
    return data;
  }
  const ns = NormalizedSchema.of(schema);
  if (ns.getMergedTraits().sensitive) {
    return SENSITIVE_STRING;
  }

  if (ns.isListSchema()) {
    const valueSchema = ns.getValueSchema();
    if (valueSchema.getMergedTraits().sensitive) {
      return SENSITIVE_STRING;
    }
    if (Array.isArray(data)) {
      return data.map((value) => schemaLogFilter(valueSchema, value));
    }
  } else if (ns.isMapSchema()) {
    const valueSchema = ns.getValueSchema();
    if (ns.getKeySchema().getMergedTraits().sensitive || valueSchema.getMergedTraits().sensitive) {
      return SENSITIVE_STRING;
    }
    if (typeof data === "object") {
      return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, schemaLogFilter(valueSchema, value)]));
    }
  } else if (ns.isStructSchema() && typeof data === "object") {
    const object = data as Record<string, unknown>;

    const newObject = {} as any;
    for (const [member, memberNs] of ns.structIterator()) {
      if (object[member] != null) {
        newObject[member] = schemaLogFilter(memberNs, object[member]);
      }
    }
    return newObject;
  }

  return data;
}
