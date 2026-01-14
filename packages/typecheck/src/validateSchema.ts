import { NormalizedSchema } from "@smithy/core/schema";
import { NumericValue } from "@smithy/core/serde";
import type { $SchemaRef, StaticStructureSchema } from "@smithy/types";

/**
 * Provides list of validation errors, which may be empty.
 * @public
 * @param schema - to validate against.
 * @param data - to validate.
 * @param path - object path for error message contextualization.
 */
export function validateSchema(schema: $SchemaRef, data: unknown, path = "{}"): string[] {
  const errors: string[] = [];
  if (data == undefined) {
    return errors;
  }
  const $ = NormalizedSchema.of(schema);
  if ($.isStringSchema()) {
    if (typeof data !== "string") {
      errors.push(`${path}: expected string, got ${typeof data}.`);
    }
  } else if ($.isNumericSchema()) {
    if (typeof data !== "number") {
      errors.push(`${path}: expected number, got ${typeof data}.`);
    }
  } else if ($.isBigIntegerSchema()) {
    if (typeof data !== "bigint") {
      errors.push(`${path}: expected bigint, got ${typeof data}.`);
    }
  } else if ($.isBigDecimalSchema()) {
    if (!(data instanceof NumericValue)) {
      errors.push(`${path}: expected NumericValue, got ${typeof data}.`);
    }
  } else if ($.isBooleanSchema()) {
    if (typeof data !== "boolean") {
      errors.push(`${path}: expected boolean, got ${typeof data}.`);
    }
  } else if ($.isBlobSchema()) {
    if ($.isStreaming()) {
      // many types are allowed for streaming payloads.
    } else {
      if (!(data instanceof Uint8Array)) {
        errors.push(`${path}: expected Uint8Array, got ${typeof data}.`);
      }
    }
  } else if ($.isTimestampSchema()) {
    if (!(data instanceof Date)) {
      errors.push(`${path}: expected Date, got ${typeof data}.`);
    }
  } else if ($.isMapSchema()) {
    if (typeof data !== "object") {
      errors.push(`${path}:expected map object, got ${typeof data}.`);
    } else {
      const sparse = !!$.getMergedTraits().sparse;
      const map$ = $.getValueSchema();
      for (const [key, value] of Object.entries(data)) {
        if (value == null) {
          if (!sparse) {
            errors.push(`${path}[${key}]: should be non-null.`);
          }
        } else {
          errors.push(...validateSchema(map$, value, path + `["${key}"]`));
        }
      }
    }
  } else if ($.isListSchema()) {
    if (!Array.isArray(data)) {
      errors.push(`${path}:expected array (list), got ${typeof data}.`);
    } else {
      const list$ = $.getValueSchema();
      const sparse = !!$.getMergedTraits().sparse;

      for (let i = 0; i < data.length; ++i) {
        const value = data[i];
        if (value == null) {
          if (!sparse) {
            errors.push(`${path}[${i}]: should be non-null.`);
          }
        } else {
          errors.push(...validateSchema(list$, value, path + `[${i}]`));
        }
      }
    }
  } else if ($.isStructSchema()) {
    if (typeof data !== "object") {
      errors.push(`${path}: expected {${$.getName(true)}}, got ${typeof data}`);
    } else {
      const keys = new Set(Object.keys(data));
      let required = ($.getSchema() as StaticStructureSchema)?.[6] ?? 0;
      for (const [member, member$] of $.structIterator()) {
        keys.delete(member);
        const value = (data as any)[member];
        const isRequired = required-- > 0;
        if (isRequired && value == null) {
          errors.push(`${path}.${member}: is required.`);
        } else {
          errors.push(...validateSchema(member$, value, path + `.${member}`));
        }
      }
      if (keys.size > 0) {
        errors.unshift(`${path}: unmatched keys: ${Array.from(keys).join(", ")}.`);
      }
    }
  }

  return errors;
}
