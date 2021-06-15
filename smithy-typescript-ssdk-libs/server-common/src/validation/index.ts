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

import { SmithyException } from "@aws-sdk/smithy-client";

export * from "./validators";

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
  constraintType: "required" = "required";

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
) => SmithyException | undefined;

export const generateValidationSummary = (failures: readonly ValidationFailure[]): string => {
  const failingPaths = new Set(failures.map((failure) => failure.path));

  let message = `${failures.length} validation error${failures.length > 1 ? "s" : ""} `;

  if (failures.length > 1) {
    message += `at ${failingPaths.size} ` + `path${failingPaths.size > 1 ? "s" : ""} `;
  }

  message += "detected. ";

  if (failures.length > 1) {
    message += "First failure: ";
  }

  return message + generateValidationMessage(failures[0]);
};

export const generateValidationMessage = (failure: ValidationFailure): string => {
  let failureValue;
  if (failure.constraintType === "required") {
    failureValue = "null ";
  } else if (failure.failureValue === null) {
    failureValue = "";
  } else {
    failureValue = failure.failureValue.toString() + " ";
  }

  let prefix = "Value";
  let suffix: string;
  switch (failure.constraintType) {
    case "required": {
      suffix = "must not be null";
      break;
    }
    case "enum": {
      suffix = `must satisfy enum value set: ${failure.constraintValues}`;
      break;
    }
    case "length": {
      if (failure.failureValue !== null) {
        prefix = prefix + " with length";
      }
      const min = failure.constraintValues[0];
      const max = failure.constraintValues[1];
      if (min === undefined) {
        suffix = `must have length less than or equal to ${max}`;
      } else if (max === undefined) {
        suffix = `must have length greater than or equal to ${min}`;
      } else {
        suffix = `must have length between ${min} and ${max}, inclusive`;
      }
      break;
    }
    case "pattern": {
      suffix = `must satisfy regular expression pattern: ${failure.constraintValues}`;
      break;
    }
    case "range": {
      const min = failure.constraintValues[0];
      const max = failure.constraintValues[1];
      if (min === undefined) {
        suffix = `must be less than or equal to ${max}`;
      } else if (max === undefined) {
        suffix = `must be greater than or equal to ${min}`;
      } else {
        suffix = `must be between ${min} and ${max}, inclusive`;
      }
      break;
    }
    case "uniqueItems": {
      prefix = prefix + " with repeated values";
      suffix = "must have unique values";
    }
  }
  return `${prefix} ${failureValue}at '${failure.path}' failed to satisfy constraint: Member ${suffix}`;
};
