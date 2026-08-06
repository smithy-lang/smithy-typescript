/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SchemaTraitsObject } from "@smithy/types";

/**
 * Extends the base schema traits with server-side constraint fields
 * used for input validation. These traits are only emitted in server SDK schemas.
 *
 * @public
 */
export interface ServerSchemaTraits extends SchemaTraitsObject {
  /**
   * Length constraint: [min, max].
   * Either min or max may be undefined if only one bound is specified.
   */
  length?: [number | undefined, number | undefined];

  /**
   * Range constraint: [min, max].
   * Either min or max may be undefined if only one bound is specified.
   */
  range?: [number | undefined, number | undefined];

  /**
   * Pattern constraint: regex string that the value must match.
   */
  pattern?: string;

  /**
   * UniqueItems constraint: list members must be unique.
   */
  uniqueItems?: 1;
}
