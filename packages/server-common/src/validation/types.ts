/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServiceException } from "./errors";

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
