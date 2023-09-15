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

import * as util from "util";

import type { Input } from "./unique";
import { findDuplicates } from "./unique";

describe("findDuplicates", () => {
  describe("finds duplicates in", () => {
    it("strings", () => {
      expect(findDuplicates(["a", "b", "c", "a", "b", "a"])).toEqual(["a", "b"]);
      expect(findDuplicates(["x", "y", "z", "a", "b", "c", "a", "b"])).toEqual(["a", "b"]);
    });
    it("numbers", () => {
      expect(findDuplicates([1, 2, 3, 4, 1, 2])).toEqual([1, 2]);
    });
    it("booleans", () => {
      expect(findDuplicates([true, false, true])).toEqual([true]);
    });
    it("arrays", () => {
      expect(
        findDuplicates([
          [5, 6],
          [2, 3],
          [1, 2],
          [3, 4],
          [1, 2],
        ])
      ).toEqual([[1, 2]]);
    });
    it("Dates", () => {
      expect(findDuplicates([new Date(1000), new Date(2000), new Date(1000)])).toEqual([new Date(1000)]);
    });
    it("Blobs", () => {
      expect(findDuplicates([Uint8Array.of(1, 2, 3), Uint8Array.of(4, 5, 6), Uint8Array.of(4, 5, 6)])).toEqual([
        Uint8Array.of(4, 5, 6),
      ]);
    });
    it("nulls", () => {
      expect(findDuplicates([null, 1, null])).toEqual([null]);
    });
    it("undefineds", () => {
      const arr: Array<any> = [undefined, 1, undefined];
      expect(findDuplicates(arr)).toEqual([undefined]);
    });
    it("objects", () => {
      expect(findDuplicates([{ a: "b" }, { b: [1, 2, 3] }, { a: "b" }, { a: "b" }])).toEqual([{ a: "b" }]);
      expect(findDuplicates([{ a: "b" }, { b: 1, c: 2 }, { c: 2, b: 1 }])).toEqual([{ b: 1, c: 2 }]);
    });
    it("deeply nested objects", () => {
      expect(
        findDuplicates([
          { a: { b: { c: [1, { d: 2 }, [3]] } } },
          2,
          [3, 4],
          { b: "c" },
          { a: { b: { c: [1, { d: 2 }, [3]] } } },
        ])
      ).toEqual([{ a: { b: { c: [1, { d: 2 }, [3]] } } }]);
    });
  });
  describe("correctly does not find duplicates in", () => {
    it("strings", () => {
      expect(findDuplicates(["a", "b", "c"])).toEqual([]);
    });
    it("numbers", () => {
      expect(findDuplicates([1, 2, 3, 4])).toEqual([]);
      expect(findDuplicates([1, 2, "1", "2"])).toEqual([]);
    });
    it("booleans", () => {
      expect(findDuplicates([true, false])).toEqual([]);
      expect(findDuplicates([true, false, "true", "false"])).toEqual([]);
    });
    it("arrays", () => {
      expect(
        findDuplicates([
          [1, 2],
          [2, 3],
          [3, 4],
        ])
      ).toEqual([]);
      expect(
        findDuplicates([
          [1, 2],
          ["1", "2"],
        ])
      ).toEqual([]);
    });
    it("objects", () => {
      expect(findDuplicates([{ a: "b" }, { b: [1, 2, 3] }])).toEqual([]);
      expect(findDuplicates([{ a: 1 }, { a: "1" }])).toEqual([]);
    });
    it("Dates", () => {
      expect(findDuplicates([new Date(100), new Date(200), new Date(101)])).toEqual([]);
    });
    it("blobs", () => {
      expect(findDuplicates([Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2)])).toEqual([]);
    });
    it("nulls", () => {
      expect(findDuplicates([null, 1])).toEqual([]);
    });
    it("undefineds", () => {
      const arr: Array<any> = [undefined, 1];
      expect(findDuplicates(arr)).toEqual([]);
    });
  });
  // This is relatively slow and may be flaky if the input size is tuned to let it run reasonably fast
  it.skip("is faster than the naive implementation", () => {
    const input: Input[] = [true, false, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 10_000; i++) {
      input.push({ a: [1, 2, 3, i], b: { nested: [true] } });
    }

    const uniqueStart = Date.now();
    expect(findDuplicates(input)).toEqual([]);
    const uniqueEnd = Date.now();
    const uniqueDuration = (uniqueEnd - uniqueStart) / 1000;

    console.log(`findDuplicates finished in ${uniqueDuration} seconds`);

    const naiveStart = Date.now();
    expect(naivefindDuplicates(input)).toEqual([]);
    const naiveEnd = Date.now();
    const naiveDuration = (naiveEnd - naiveStart) / 1000;

    console.log(`naivefindDuplicates finished in ${naiveDuration} seconds`);

    expect(naiveDuration).toBeGreaterThan(uniqueDuration);
  });

  // This isn't even correct! It should be even slower, it just returns the first duplicate!
  function naivefindDuplicates(input: Array<Input>): Input | undefined {
    for (let i = 0; i < input.length - 1; i++) {
      for (let j = i + 1; j < input.length; j++) {
        if (util.isDeepStrictEqual(input[i], input[j])) {
          return [input[i]];
        }
      }
    }
    return [];
  }
});
