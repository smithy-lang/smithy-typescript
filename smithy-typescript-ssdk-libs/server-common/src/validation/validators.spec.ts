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

import {
  CompositeValidator,
  EnumValidator,
  IntegerEnumValidator,
  LengthValidator,
  PatternValidator,
  RangeValidator,
  SensitiveConstraintValidator,
  SingleConstraintValidator,
  UniqueItemsValidator,
} from "./validators";

describe("sensitive validation", () => {
  function sensitize<T, V>(validator: SingleConstraintValidator<T, V>, input: T): V {
    const failure = new SensitiveConstraintValidator(new CompositeValidator<T>([validator])).validate(input, "")[0];
    return failure as unknown as V;
  }

  describe("strips the failure value from the resultant validation failure", () => {
    it("with enums", () => {
      expect(sensitize(new EnumValidator(["apple", "banana", "orange"], ["apple"]), "pear").failureValue).toBeNull();
    });
    it("with integer enums", () => {
      expect(sensitize(new IntegerEnumValidator([1, 2, 3]), 0).failureValue).toBeNull();
    });
    it("with length", () => {
      expect(sensitize(new LengthValidator(2, 4), "pears").failureValue).toBeNull();
    });
    it("with ranges", () => {
      expect(sensitize(new RangeValidator(2, 4), 7).failureValue).toBeNull();
    });
    it("with patterns", () => {
      expect(sensitize(new PatternValidator("^[a-c]+$"), "defg").failureValue).toBeNull();
    });
  });
});

describe("enum validation", () => {
  const enumValidator = new EnumValidator(["apple", "banana", "orange"], ["apple", "banana"]);

  it("does not fail when the enum value is found", () => {
    expect(enumValidator.validate("apple", "fruit")).toBeNull();
  });

  it("fails when the enum value is not found", () => {
    expect(enumValidator.validate("kiwi", "fruit")).toEqual({
      constraintType: "enum",
      constraintValues: ["apple", "banana"],
      path: "fruit",
      failureValue: "kiwi",
    });
  });
});

describe("integer enum validation", () => {
  const integerEnumValidator = new IntegerEnumValidator([1, 2, 3]);

  it("does not fail when the enum value is found", () => {
    expect(integerEnumValidator.validate(1, "test")).toBeNull();
  });

  it("fails when the enum value is not found", () => {
    expect(integerEnumValidator.validate(0, "test")).toEqual({
      constraintType: "integerEnum",
      constraintValues: [1, 2, 3],
      path: "test",
      failureValue: 0,
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
          path: "aThreeLengthThing",
          failureValue: 3,
        });
      });
      it("should fail with max = 2", () => {
        expect(new LengthValidator(undefined, 2).validate(value, "aThreeLengthThing")).toEqual({
          constraintType: "length",
          constraintValues: [undefined, 2],
          path: "aThreeLengthThing",
          failureValue: 3,
        });
      });
      it("should fail with min = 1 and max = 2", () => {
        expect(new LengthValidator(1, 2).validate(value, "aThreeLengthThing")).toEqual({
          constraintType: "length",
          constraintValues: [1, 2],
          path: "aThreeLengthThing",
          failureValue: 3,
        });
      });
    });
  }

  it("properly assesses string length", () => {
    expect(new LengthValidator(3, 3).validate("👍👍👍", "threeEmojis")).toBeNull();
  });
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
      path: "aField",
    });
  });
  it("supports character class expressions", () => {
    const validator = new PatternValidator("^\\p{L}+$");
    expect(validator.validate("hello", "aField")).toBeNull();
    expect(validator.validate("!hello!", "aField")).toEqual({
      constraintType: "pattern",
      constraintValues: "^\\p{L}+$",
      failureValue: "!hello!",
      path: "aField",
    });
  });
  it("is not vulnerable to ReDoS", () => {
    const validator = new PatternValidator("^([0-9]+)+$");
    expect(
      validator.validate(
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000!",
        "aField"
      )
    ).toEqual({
      constraintType: "pattern",
      constraintValues: "^([0-9]+)+$",
      failureValue: "000000000000000000000000000000000000000000000000000000000000000000000000000000000000!",
      path: "aField",
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
      path: "aField",
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
      path: "aField",
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
      path: "aField",
    });
    expect(validator.validate(6, "aField")).toEqual({
      constraintType: "range",
      constraintValues: [3, 5],
      failureValue: 6,
      path: "aField",
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
      path: "aField",
    });
  });
  describe("supports numbers", () => {
    expect(validator.validate([1, 2, 3], "aField")).toBeNull();
    expect(validator.validate([1, 1, 3, 1, 1, 2.5, 2.5], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: [1, 2.5],
      path: "aField",
    });
  });
  describe("supports booleans, I guess", () => {
    expect(validator.validate([true, false], "aField")).toBeNull();
    expect(validator.validate([true, false, true], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: [true],
      path: "aField",
    });
  });
  describe("supports objects", () => {
    expect(validator.validate([{ a: 1 }, { b: 2 }], "aField")).toBeNull();
    expect(validator.validate([{ a: 1 }, { b: 2 }, { a: 1 }], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: [{ a: 1 }],
      path: "aField",
    });
  });
  describe("supports undefined values inside objects in lists", () => {
    expect(() => validator.validate([{ a: [{ a: undefined }] }], "aField")).not.toThrowError();
    expect(validator.validate([{ a: [{ a: null }] }, { a: [{ a: undefined }] }], "aField")).toBeNull();
    expect(validator.validate([{ a: [{ a: undefined }] }, { a: [{ a: undefined }] }], "aField")).toEqual({
      constraintType: "uniqueItems",
      failureValue: [{ a: [{ a: undefined }] }],
      path: "aField",
    });
  });
});
