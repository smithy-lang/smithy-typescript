/*
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *   http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import { createHash } from "crypto";
import * as util from "util";

/**
 * A shortcut for JSON and Smithy primitives, as well as documents and Smithy-
 * modeled structures composed of those primitives
 */
export type Input = { [key: string]: Input } | Array<Input> | Date | Uint8Array | string | number | boolean | null;

/**
 * Returns an array of duplicated values in the input. This is equivalent to using
 * {@link util#isDeepStrictEqual} to compare every member of the input to all the
 * other members, but with an optimization to make the runtime complexity O(n)
 * instead of O(n^2).
 *
 * @param input an array of {@link Input}
 * @return an array containing one instance of every duplicated member of the input,
 *         or an empty array if there are no duplicates
 */
export const findDuplicates = (input: Array<Input>): Array<Input> => {
  const potentialCollisions: { [hash: string]: { value: Input; alreadyFound: boolean }[] } = {};
  const collisions: Array<Input> = [];

  for (const value of input) {
    const valueHash = hash(value);
    if (!potentialCollisions.hasOwnProperty(valueHash)) {
      potentialCollisions[valueHash] = [{ value: value, alreadyFound: false }];
    } else {
      let duplicateFound = false;
      for (const potentialCollision of potentialCollisions[valueHash]) {
        if (util.isDeepStrictEqual(value, potentialCollision.value)) {
          duplicateFound = true;
          if (!potentialCollision.alreadyFound) {
            collisions.push(value);
            potentialCollision.alreadyFound = true;
          }
        }
      }
      if (!duplicateFound) {
        potentialCollisions[valueHash].push({ value: value, alreadyFound: false });
      }
    }
  }
  return collisions;
};

const hash = (input: Input): string => {
  return createHash("sha256").update(canonicalize(input)).digest("base64");
};

/**
 * Since node's hash functions operate on strings or buffers, we need a canonical format for
 * our objects in order to hash them correctly. This function turns them into string representations
 * where the types are encoded in order to avoid ambiguity, for instance, between the string "1" and
 * the number 1. This method sorts object keys lexicographically in order to maintain consistency.
 *
 * This doesn't just call JSON.stringify because we want to have firm control over the ordering of map
 * keys and the handling of blobs and dates
 *
 * @param input a JSON-like object
 * @return a canonical string representation
 */
const canonicalize = (input: Input): string => {
  if (input === undefined) {
    return "undefined()";
  }

  if (input === null) {
    return "null()";
  }
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return `${typeof input}(${input.toString()})`;
  }
  if (Array.isArray(input)) {
    return "array(" + input.map((i) => canonicalize(i)).join(",") + ")";
  }
  if (input instanceof Date) {
    return "date(" + input.getTime() + ")";
  }
  if (input instanceof Uint8Array) {
    // hashing the blob just to avoid allocating another base64 copy of its data
    return "blob(" + createHash("sha256").update(input).digest("base64") + ")";
  }

  const contents: Array<string> = [];
  for (const key of Object.keys(input).slice().sort()) {
    contents.push("key(" + key + ")->value(" + canonicalize(input[key]) + ")");
  }
  return "map(" + contents.join(",") + ")";
};
