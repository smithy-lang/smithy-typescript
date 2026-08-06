/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedSchema } from "@smithy/core/schema";
import { NumericValue } from "@smithy/core/serde";
import type { $SchemaRef, StaticStructureSchema } from "@smithy/types";
import type { ServerSchemaTraits } from "./serverSchemaTraits";

/**
 * Validates data against a schema, including server-side constraint traits
 * (length, range, pattern, uniqueItems).
 *
 * This is the server-side equivalent of `@smithy/typecheck`'s `validateSchema`,
 * extended with constraint enforcement for input validation.
 *
 * @public
 * @param schema - to validate against.
 * @param data - to validate.
 * @param path - object path for error message contextualization.
 * @returns list of validation error strings (empty if valid).
 */
export function validateServerSchema(schema: $SchemaRef, data: unknown, path = "{}"): string[] {
  const errors: string[] = [];
  if (data == undefined) {
    return errors;
  }
  const $ = NormalizedSchema.of(schema);
  const traits = $.getMergedTraits() as ServerSchemaTraits;

  if ($.isStringSchema()) {
    if (typeof data !== "string") {
      errors.push(`${path}: expected string, got ${typeof data}.`);
    } else {
      validateLength(errors, path, data.length, traits);
      validatePattern(errors, path, data, traits);
    }
  } else if ($.isNumericSchema()) {
    if (typeof data !== "number") {
      errors.push(`${path}: expected number, got ${typeof data}.`);
    } else {
      validateRange(errors, path, data, traits);
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
      } else {
        validateLength(errors, path, data.byteLength, traits);
      }
    }
  } else if ($.isTimestampSchema()) {
    if (!(data instanceof Date)) {
      errors.push(`${path}: expected Date, got ${typeof data}.`);
    }
  } else if ($.isMapSchema()) {
    if (typeof data !== "object") {
      errors.push(`${path}: expected map object, got ${typeof data}.`);
    } else {
      const entries = Object.entries(data as object);
      validateLength(errors, path, entries.length, traits);
      const sparse = !!traits.sparse;
      const map$ = $.getValueSchema();
      for (const [key, value] of entries) {
        if (value == null) {
          if (!sparse) {
            errors.push(`${path}["${key}"]: should be non-null.`);
          }
        } else {
          errors.push(...validateServerSchema(map$, value, path + `["${key}"]`));
        }
      }
    }
  } else if ($.isListSchema()) {
    if (!Array.isArray(data)) {
      errors.push(`${path}: expected array (list), got ${typeof data}.`);
    } else {
      validateLength(errors, path, data.length, traits);
      validateUniqueItems(errors, path, data, traits);
      const list$ = $.getValueSchema();
      const sparse = !!traits.sparse;

      for (let i = 0; i < data.length; ++i) {
        const value = data[i];
        if (value == null) {
          if (!sparse) {
            errors.push(`${path}[${i}]: should be non-null.`);
          }
        } else {
          errors.push(...validateServerSchema(list$, value, path + `[${i}]`));
        }
      }
    }
  } else if ($.isStructSchema()) {
    if (typeof data !== "object") {
      errors.push(`${path}: expected {${$.getName(true)}}, got ${typeof data}`);
    } else {
      const keys = new Set(Object.keys(data as object));
      let required = ($.getSchema() as StaticStructureSchema)?.[6] ?? 0;
      for (const [member, member$] of $.structIterator()) {
        keys.delete(member);
        const value = (data as Record<string, unknown>)[member];
        const isRequired = required-- > 0;
        if (isRequired && value == null) {
          errors.push(`${path}.${member}: is required.`);
        } else {
          errors.push(...validateServerSchema(member$, value, path + `.${member}`));
        }
      }
    }
  }

  return errors;
}

/**
 * Validates length constraint (applies to strings, blobs, lists, maps).
 */
function validateLength(errors: string[], path: string, actualLength: number, traits: ServerSchemaTraits): void {
  const constraint = traits.length;
  if (!constraint) {
    return;
  }
  const [min, max] = constraint;
  if (min !== undefined && actualLength < min) {
    errors.push(`${path}: length ${actualLength} is less than minimum ${min}.`);
  }
  if (max !== undefined && actualLength > max) {
    errors.push(`${path}: length ${actualLength} exceeds maximum ${max}.`);
  }
}

/**
 * Validates range constraint (applies to numbers).
 */
function validateRange(errors: string[], path: string, value: number, traits: ServerSchemaTraits): void {
  const constraint = traits.range;
  if (!constraint) {
    return;
  }
  const [min, max] = constraint;
  if (min !== undefined && value < min) {
    errors.push(`${path}: value ${value} is less than minimum ${min}.`);
  }
  if (max !== undefined && value > max) {
    errors.push(`${path}: value ${value} exceeds maximum ${max}.`);
  }
}

/**
 * Validates pattern constraint (applies to strings).
 */
function validatePattern(errors: string[], path: string, value: string, traits: ServerSchemaTraits): void {
  const pattern = traits.pattern;
  if (!pattern) {
    return;
  }
  if (!new RegExp(pattern, "u").test(value)) {
    errors.push(`${path}: value does not match pattern: ${pattern}.`);
  }
}

/**
 * Validates uniqueItems constraint (applies to lists).
 */
function validateUniqueItems(errors: string[], path: string, data: unknown[], traits: ServerSchemaTraits): void {
  if (!traits.uniqueItems) {
    return;
  }
  const seen = new Set<string>();
  for (let i = 0; i < data.length; ++i) {
    const serialized = JSON.stringify(data[i]);
    if (seen.has(serialized)) {
      errors.push(`${path}[${i}]: duplicate item violates uniqueItems constraint.`);
    }
    seen.add(serialized);
  }
}
