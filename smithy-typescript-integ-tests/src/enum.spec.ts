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

import { TestInput, Enum } from "@aws-smithy/typescript-integ-test-types";

describe("enum constraints", () => {
  const validEnum: Enum = "valueA";
  const invalidEnum: string = "invalidEnum";
  const expectedFailureBase = {
    constraintType: "enum",
    constraintValues: ["valueA", "valueB"],
    failureValue: invalidEnum,
  };
  it("handles bare enums", () => {
    expect(TestInput.validate({ enum: validEnum })).toEqual([]);
    expect(TestInput.validate({ enum: invalidEnum })).toEqual([
      {
        memberName: "enum",
        ...expectedFailureBase,
      },
    ]);
  });
  it("handles enum lists", () => {
    expect(TestInput.validate({ enumList: [validEnum] })).toEqual([]);
    expect(TestInput.validate({ enumList: [invalidEnum] })).toEqual([
      {
        memberName: "enumList",
        ...expectedFailureBase,
      },
    ]);
    expect(TestInput.validate({ enumList: [validEnum, invalidEnum] })).toEqual([
      {
        memberName: "enumList",
        ...expectedFailureBase,
      },
    ]);
  });
  it("handles enum maps", () => {
    expect(TestInput.validate({ enumMap: { valid: validEnum } })).toEqual([]);
    expect(TestInput.validate({ enumMap: { invalid: invalidEnum } })).toEqual([
      {
        memberName: "enumMap",
        ...expectedFailureBase,
      },
    ]);
    expect(
      TestInput.validate({
        enumMap: { valid: validEnum, invalid: invalidEnum },
      })
    ).toEqual([
      {
        memberName: "enumMap",
        ...expectedFailureBase,
      },
    ]);
  });
});
