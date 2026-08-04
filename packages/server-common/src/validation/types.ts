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

import type { ServiceException } from "../errors";

interface StandardValidationFailure<ConstraintBoundsType, FailureType> {
  path: string;
  constraintType: string;
  constraintValues: ArrayLike<ConstraintBoundsType>;
  failureValue: FailureType | null;
}

export interface EnumValidationFailure extends StandardValidationFailure<string, string> {
  constraintType: "enum";
  constraintValues: string[];
}

export interface IntegerEnumValidationFailure extends StandardValidationFailure<number, number> {
  constraintType: "integerEnum";
  constraintValues: number[];
}

export interface LengthValidationFailure extends StandardValidationFailure<number | undefined, number> {
  constraintType: "length";
  constraintValues: [number, number] | [undefined, number] | [number, undefined];
}

export interface PatternValidationFailure {
  path: string;
  constraintType: "pattern";
  constraintValues: string;
  failureValue: string | null;
}

export interface RangeValidationFailure extends StandardValidationFailure<number | undefined, number> {
  constraintType: "range";
  constraintValues: [number, number] | [undefined, number] | [number, undefined];
}

export class RequiredValidationFailure {
  path: string;
  constraintType = "required" as const;

  constructor(path: string) {
    this.path = path;
  }
}

export interface UniqueItemsValidationFailure {
  path: string;
  constraintType: "uniqueItems";
  failureValue: Array<any> | null;
}

export type ValidationFailure =
  | EnumValidationFailure
  | IntegerEnumValidationFailure
  | LengthValidationFailure
  | PatternValidationFailure
  | RangeValidationFailure
  | RequiredValidationFailure
  | UniqueItemsValidationFailure;

export interface ValidationContext<O extends string> {
  operation: O;
}

export type ValidationCustomizer<O extends string> = (
  context: ValidationContext<O>,
  failures: ValidationFailure[]
) => ServiceException | undefined;
