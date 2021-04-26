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

import { EnumValidator, LengthValidator, PatternValidator, RangeValidator, UniqueItemsValidator } from "./validators";

describe("enum validation", () => {
  const enumValidator = new EnumValidator(["apple", "banana", "orange"]);

  it("does not fail when the enum value is found", () => {
    expect(enumValidator.validate("apple", "fruit")).toBeNull();
  });

  it("fails when the enum value is not found", () => {
    expect(enumValidator.validate("kiwi", "fruit")).toEqual({
      constraintType: "enum",
      constraintValues: ["apple", "banana", "orange"],
      memberName: "fruit",
      failureValue: "kiwi",
    });
  });
});

describe("length validation", () => {
  const threeLengthThings = ["foo", { a: 1, b: 2, c: 3 }, ["a", "b", "c"], new Uint8Array([13, 37, 42])];

  for (const value of threeLengthThings) {
    describe(`for ${JSON.stringify(value)}`, () => {
      it("should succeed with min = 1", () => {
        expect(new LengthValidator(1).validate(value, "aThreeLengthThing")).toBeNull();
      });
      it("should succeed with min = 3", () => {
        expect(new LengthValidator(3).validate(value, "aThreeLengthThing")).toBeNull();
      });
      it("should succeed with max = 100", () => {
        expect(new LengthValidator(undefined, 100).validate(value, "aThreeLengthThing")).toBeNull();
      });
      it("should succeed with max = 3", () => {
        expect(new LengthValidator(undefined, 3).validate(value, "aThreeLengthThing")).toBeNull();
      });
      it("should succeed with min = 3 and max = 3", () => {
        expect(new LengthValidator(3, 3).validate(value, "aThreeLengthThing")).toBeNull();
      });
      it("should succeed with min = 1 and max = 128", () => {
        expect(new LengthValidator(1, 128).validate(value, "aThreeLengthThing")).toBeNull();
      });
      it("should fail with min = 4", () => {
        expect(new LengthValidator(4).validate(value, "aThreeLengthThing")).toEqual({
          constraintType: "length",
          constraintValues: [4, undefined],
          memberName: "aThreeLengthThing",
          failureValue: 3,
        });
      });
      it("should fail with max = 2", () => {
        expect(new LengthValidator(undefined, 2).validate(value, "aThreeLengthThing")).toEqual({
          constraintType: "length",
          constraintValues: [undefined, 2],
          memberName: "aThreeLengthThing",
          failureValue: 3,
        });
      });
      it("should fail with min = 1 and max = 2", () => {
        expect(new LengthValidator(1, 2).validate(value, "aThreeLengthThing")).toEqual({
          constraintType: "length",
          constraintValues: [1, 2],
          memberName: "aThreeLengthThing",
          failureValue: 3,
        });
      });
    });
  }
});

describe("pattern validation", () => {
  it("does not match the entire string", () => {
    const validator = new PatternValidator("\\w+");
    expect(validator.validate("hello", "aField")).toBeNull();
    expect(validator.validate("!hello!", "aField")).toBeNull();
  });
  it("can be anchored", () => {
    const validator = new PatternValidator("^\\w+$");
    expect(validator.validate("hello", "aField")).toBeNull();
    expect(validator.validate("!hello!", "aField")).toEqual({
      constraintType: "pattern",
      constraintValues: "^\\w+$",
      failureValue: "!hello!",
      memberName: "aField",
    });
  });
  it("supports character class expressions", () => {
    const validator = new PatternValidator("^\\p{L}+$");
    expect(validator.validate("hello", "aField")).toBeNull();
    expect(validator.validate("!hello!", "aField")).toEqual({
      constraintType: "pattern",
      constraintValues: "^\\p{L}+$",
      failureValue: "!hello!",
      memberName: "aField",
    });
  });
});

describe("range validation", () => {
  it("supports min-only constraints", () => {
    const validator = new RangeValidator(3);
    expect(validator.validate(3, "aField")).toBeNull();
    expect(validator.validate(4, "aField")).toBeNull();
    expect(validator.validate(1, "aField")).toEqual({
      constraintType: "range",
      constraintValues: [3, undefined],
      failureValue: 1,
      memberName: "aField",
    });
  });
  it("supports max-only constraints", () => {
    const validator = new RangeValidator(undefined, 3);
    expect(validator.validate(3, "aField")).toBeNull();
    expect(validator.validate(1, "aField")).toBeNull();
    expect(validator.validate(4, "aField")).toEqual({
      constraintType: "range",
      constraintValues: [undefined, 3],
      failureValue: 4,
      memberName: "aField",
    });
  });
  it("supports min-max constraints", () => {
    const validator = new RangeValidator(3, 5);
    expect(validator.validate(3, "aField")).toBeNull();
    expect(validator.validate(4, "aField")).toBeNull();
    expect(validator.validate(5, "aField")).toBeNull();
    expect(validator.validate(1, "aField")).toEqual({
      constraintType: "range",
      constraintValues: [3, 5],
      failureValue: 1,
      memberName: "aField",
    });
    expect(validator.validate(6, "aField")).toEqual({
      constraintType: "range",
      constraintValues: [3, 5],
      failureValue: 6,
      memberName: "aField",
    });
  });
});

describe("uniqueItems", () => {
  const validator = new UniqueItemsValidator();
  describe("supports strings", () => {
    expect(validator.validate(["a", "b", "c"], "aField")).toBeNull();
    expect(validator.validate(["a", "a", "c", "a", "b", "b"], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: ["a", "b"],
      memberName: "aField",
    });
  });
  describe("supports numbers", () => {
    expect(validator.validate([1, 2, 3], "aField")).toBeNull();
    expect(validator.validate([1, 1, 3, 1, 1, 2.5, 2.5], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: [1, 2.5],
      memberName: "aField",
    });
  });
  describe("supports booleans, I guess", () => {
    expect(validator.validate([true, false], "aField")).toBeNull();
    expect(validator.validate([true, false, true], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: [true],
      memberName: "aField",
    });
  });
});
