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

export * from "./validators";

interface StandardValidationFailure<ConstraintBoundsType, FailureType> {
  memberName: string;
  constraintType: string;
  constraintValues: ArrayLike<ConstraintBoundsType>;
  failureValue: FailureType;
}

export interface EnumValidationFailure extends StandardValidationFailure<string, string> {
  constraintType: "enum";
  constraintValues: string[];
}

export interface LengthValidationFailure extends StandardValidationFailure<number | undefined, number> {
  constraintType: "length";
  constraintValues: [number, number] | [undefined, number] | [number, undefined];
}

export interface PatternValidationFailure {
  memberName: string;
  constraintType: "pattern";
  constraintValues: string;
  failureValue: string;
}

export interface RangeValidationFailure extends StandardValidationFailure<number | undefined, number> {
  constraintType: "range";
  constraintValues: [number, number] | [undefined, number] | [number, undefined];
}

export class RequiredValidationFailure {
  memberName: string;
  constraintType = "required";

  constructor(memberName: string) {
    this.memberName = memberName;
  }
}

export interface UniqueItemsValidationFailure {
  memberName: string;
  constraintType: "uniqueItems";
  failureValue: Array<any>;
}

export type ValidationFailure =
  | EnumValidationFailure
  | LengthValidationFailure
  | PatternValidationFailure
  | RangeValidationFailure
  | RequiredValidationFailure
  | UniqueItemsValidationFailure;
