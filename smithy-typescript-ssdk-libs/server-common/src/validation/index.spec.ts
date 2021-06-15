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
  EnumValidationFailure,
  generateValidationMessage,
  LengthValidationFailure,
  PatternValidationFailure,
  RangeValidationFailure,
  RequiredValidationFailure,
} from "./index";

describe("message formatting", () => {
  it("does not return very large inputs", () => {
    const failure: PatternValidationFailure = {
      constraintType: "pattern",
      constraintValues: "^[a-c]$",
      failureValue: "z".repeat(1024),
      path: "/test",
    };
    expect(generateValidationMessage(failure)).toEqual(
      "Value zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz... " +
        "(truncated) at '/test' failed to satisfy constraint: Member must satisfy regular expression pattern: ^[a-c]$"
    );
  });
  it("omits null values", () => {
    const failure: PatternValidationFailure = {
      constraintType: "pattern",
      constraintValues: "^[a-c]$",
      failureValue: null,
      path: "/test",
    };
    expect(generateValidationMessage(failure)).toEqual(
      "Value at '/test' failed to satisfy constraint: Member must satisfy regular expression pattern: ^[a-c]$"
    );
  });
  it("formats required failures", () => {
    const failure = new RequiredValidationFailure("/test");
    expect(generateValidationMessage(failure)).toEqual(
      "Value null at '/test' failed to satisfy constraint: Member must not be null"
    );
  });
  it("formats enum failures", () => {
    const failure: EnumValidationFailure = {
      constraintType: "enum",
      constraintValues: ["banana", "apple"],
      failureValue: "pear",
      path: "/test",
    };
    expect(generateValidationMessage(failure)).toEqual(
      "Value pear at '/test' failed to satisfy constraint: Member must satisfy enum value set: [apple, banana]"
    );
  });
  describe("formats length failures", () => {
    it("with only min values", () => {
      const failure: LengthValidationFailure = {
        constraintType: "length",
        constraintValues: [7, undefined],
        failureValue: 3,
        path: "/test",
      };
      expect(generateValidationMessage(failure)).toEqual(
        "Value with length 3 at '/test' failed to satisfy constraint: Member must have length greater than or equal to 7"
      );
    });
    it("with only max values", () => {
      const failure: LengthValidationFailure = {
        constraintType: "length",
        constraintValues: [undefined, 2],
        failureValue: 3,
        path: "/test",
      };
      expect(generateValidationMessage(failure)).toEqual(
        "Value with length 3 at '/test' failed to satisfy constraint: Member must have length less than or equal to 2"
      );
    });
    it("with min and max values", () => {
      const failure: LengthValidationFailure = {
        constraintType: "length",
        constraintValues: [3, 7],
        failureValue: 2,
        path: "/test",
      };
      expect(generateValidationMessage(failure)).toEqual(
        "Value with length 2 at '/test' failed to satisfy constraint: Member must have length between 3 and 7, inclusive"
      );
    });
  });
  it("formats pattern failures", () => {
    const failure: PatternValidationFailure = {
      constraintType: "pattern",
      constraintValues: "^[a-c]$",
      failureValue: "xyz",
      path: "/test",
    };
    expect(generateValidationMessage(failure)).toEqual(
      "Value xyz at '/test' failed to satisfy constraint: Member must satisfy regular expression pattern: ^[a-c]$"
    );
  });
  describe("formats range failures", () => {
    it("with only min values", () => {
      const failure: RangeValidationFailure = {
        constraintType: "range",
        constraintValues: [7, undefined],
        failureValue: 3,
        path: "/test",
      };
      expect(generateValidationMessage(failure)).toEqual(
        "Value 3 at '/test' failed to satisfy constraint: Member must be greater than or equal to 7"
      );
    });
    it("with only max values", () => {
      const failure: RangeValidationFailure = {
        constraintType: "range",
        constraintValues: [undefined, 2],
        failureValue: 3,
        path: "/test",
      };
      expect(generateValidationMessage(failure)).toEqual(
        "Value 3 at '/test' failed to satisfy constraint: Member must be less than or equal to 2"
      );
    });
    it("with min and max values", () => {
      const failure: RangeValidationFailure = {
        constraintType: "range",
        constraintValues: [3, 7],
        failureValue: 2,
        path: "/test",
      };
      expect(generateValidationMessage(failure)).toEqual(
        "Value 2 at '/test' failed to satisfy constraint: Member must be between 3 and 7, inclusive"
      );
    });
  });
});
