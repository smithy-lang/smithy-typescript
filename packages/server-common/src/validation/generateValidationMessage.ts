/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ValidationFailure } from "./types";

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
  let prefix = "Value";
  let suffix: string;
  switch (failure.constraintType) {
    case "required": {
      suffix = "must not be null";
      break;
    }
    case "enum": {
      suffix = `must satisfy enum value set: [${failure.constraintValues
        .sort((a, b) => a.localeCompare(b))
        .join(", ")}]`;
      break;
    }
    case "integerEnum": {
      suffix = `must satisfy enum value set: [${failure.constraintValues.sort((a, b) => a - b).join(", ")}]`;
      break;
    }
    case "length": {
      if (failure.failureValue !== null) {
        prefix = prefix + " with length " + failure.failureValue;
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
      suffix = "must have unique values";
    }
  }
  return `${prefix} at '${failure.path}' failed to satisfy constraint: Member ${suffix}`;
};
