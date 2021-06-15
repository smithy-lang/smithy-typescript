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
  LengthValidationFailure,
  PatternValidationFailure,
  RangeValidationFailure,
  RequiredValidationFailure,
  UniqueItemsValidationFailure,
  ValidationFailure,
} from ".";

export class CompositeValidator<T> implements MultiConstraintValidator<T> {
  private readonly validators: SingleConstraintValidator<T, any>[];

  constructor(validators: SingleConstraintValidator<T, any>[]) {
    this.validators = validators;
  }

  validate(input: T | undefined | null, path: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    for (const v of this.validators) {
      const failure = v.validate(input, path);
      if (failure) {
        retVal.push(failure);
      }
    }
    return retVal;
  }
}

export class CompositeStructureValidator<T> implements MultiConstraintValidator<T> {
  private readonly referenceValidator: MultiConstraintValidator<T>;
  private readonly structureValidator: (input: T, path: string) => ValidationFailure[];

  constructor(
    referenceValidator: MultiConstraintValidator<T>,
    structureValidator: (input: T, path: string) => ValidationFailure[]
  ) {
    this.referenceValidator = referenceValidator;
    this.structureValidator = structureValidator;
  }

  validate(input: T | undefined | null, path: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    retVal.push(...this.referenceValidator.validate(input, path));
    if (input !== null && input !== undefined) {
      retVal.push(...this.structureValidator(input, path));
    }
    return retVal;
  }
}

export class CompositeCollectionValidator<T> implements MultiConstraintValidator<Iterable<T>> {
  private readonly referenceValidator: MultiConstraintValidator<Iterable<T>>;
  private readonly memberValidator: MultiConstraintValidator<T>;

  constructor(referenceValidator: MultiConstraintValidator<Iterable<T>>, memberValidator: MultiConstraintValidator<T>) {
    this.referenceValidator = referenceValidator;
    this.memberValidator = memberValidator;
  }

  validate(input: Iterable<T> | undefined | null, path: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    retVal.push(...this.referenceValidator.validate(input, path));
    if (input !== null && input !== undefined) {
      let i = 0;
      for (const member of input) {
        retVal.push(...this.memberValidator.validate(member, `${path}/${i}`));
        i += 1;
      }
    }
    return retVal;
  }
}

export class CompositeMapValidator<T> implements MultiConstraintValidator<{ [key: string]: T }> {
  private readonly referenceValidator: MultiConstraintValidator<{ [key: string]: T }>;
  private readonly keyValidator: MultiConstraintValidator<string>;
  private readonly valueValidator: MultiConstraintValidator<T>;

  constructor(
    referenceValidator: MultiConstraintValidator<{ [key: string]: T }>,
    keyValidator: MultiConstraintValidator<string>,
    valueValidator: MultiConstraintValidator<T>
  ) {
    this.referenceValidator = referenceValidator;
    this.keyValidator = keyValidator;
    this.valueValidator = valueValidator;
  }

  validate(input: { [key: string]: T } | undefined | null, path: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    retVal.push(...this.referenceValidator.validate(input, path));
    if (input !== null && input !== undefined) {
      Object.keys(input).forEach((key) => {
        const value = input[key];
        retVal.push(...this.keyValidator.validate(key, path));
        retVal.push(...this.valueValidator.validate(value, `${path}/${key}`));
      });
    }
    return retVal;
  }
}

export class NoOpValidator implements MultiConstraintValidator<any> {
  validate(): ValidationFailure[] {
    return [];
  }
}

export class SensitiveConstraintValidator<T> implements MultiConstraintValidator<T> {
  private readonly delegate: MultiConstraintValidator<T>;

  constructor(delegate: MultiConstraintValidator<T>) {
    this.delegate = delegate;
  }

  validate(input: T, path: string): ValidationFailure[] {
    return this.delegate.validate(input, path).map((f) => {
      return {
        ...f,
        failureValue: null,
      };
    });
  }
}

export interface MultiConstraintValidator<T> {
  validate(input: T | undefined | null, path: string): ValidationFailure[];
}

export interface SingleConstraintValidator<T, F> {
  validate(input: T | undefined | null, path: string): F | null;
}

export class EnumValidator implements SingleConstraintValidator<string, EnumValidationFailure> {
  private readonly allowedValues: string[];

  constructor(allowedValues: readonly string[]) {
    this.allowedValues = allowedValues.slice();
  }

  validate(input: string | undefined | null, path: string): EnumValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    if (this.allowedValues.indexOf(input) < 0) {
      return {
        constraintType: "enum",
        constraintValues: this.allowedValues.slice(),
        path: path,
        failureValue: input,
      };
    }

    return null;
  }
}

type LengthCheckable = { length: number } | { [key: string]: any };

export class LengthValidator implements SingleConstraintValidator<LengthCheckable, LengthValidationFailure> {
  private readonly min?: number;
  private readonly max?: number;

  constructor(min?: number, max?: number) {
    if (min === undefined && max === undefined) {
      throw new Error("Length constraints must have at least a min or a max.");
    }
    this.min = min;
    this.max = max;
  }

  validate(input: LengthCheckable | undefined | null, path: string): LengthValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    let length: number;
    if (LengthValidator.hasLength(input)) {
      length = input.length;
    } else {
      length = Object.keys(input).length;
    }

    if ((this.min !== undefined && length < this.min) || (this.max !== undefined && length > this.max)) {
      return {
        constraintType: "length",
        constraintValues:
          this.min === undefined
            ? [undefined, this.max!]
            : this.max === undefined
            ? [this.min!, undefined]
            : [this.min!, this.max!],
        path: path,
        failureValue: length,
      };
    }

    return null;
  }

  private static hasLength(obj: any): obj is { length: number } {
    return obj.hasOwnProperty("length");
  }
}

export class RangeValidator implements SingleConstraintValidator<number, RangeValidationFailure> {
  private readonly min?: number;
  private readonly max?: number;

  constructor(min?: number, max?: number) {
    if (min === undefined && max === undefined) {
      throw new Error("Range constraints must have at least a min or a max.");
    }
    this.min = min;
    this.max = max;
  }

  validate(input: number | undefined | null, path: string): RangeValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    if ((this.min !== undefined && input < this.min) || (this.max !== undefined && input > this.max)) {
      return {
        constraintType: "range",
        constraintValues:
          this.min === undefined
            ? [undefined, this.max!]
            : this.max === undefined
            ? [this.min!, undefined]
            : [this.min!, this.max!],
        path: path,
        failureValue: input,
      };
    }

    return null;
  }
}

export class PatternValidator implements SingleConstraintValidator<string, PatternValidationFailure> {
  private readonly inputPattern: string;
  private readonly pattern: RegExp;

  constructor(pattern: string) {
    this.inputPattern = pattern;
    this.pattern = new RegExp(pattern, "u");
  }

  validate(input: string | undefined | null, path: string): PatternValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    if (!input.match(this.pattern)) {
      return {
        constraintType: "pattern",
        constraintValues: this.inputPattern,
        failureValue: input,
        path: path,
      };
    }
    return null;
  }
}

export class RequiredValidator implements SingleConstraintValidator<any, RequiredValidationFailure> {
  validate(input: any, path: string): RequiredValidationFailure | null {
    if (input === null || input === undefined) {
      return new RequiredValidationFailure(path);
    }
    return null;
  }
}

export class UniqueItemsValidator implements SingleConstraintValidator<Array<any>, UniqueItemsValidationFailure> {
  validate(input: Array<any> | undefined | null, path: string): UniqueItemsValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    const repeats = new Set<any>();
    const uniqueValues = new Set<any>();
    for (const i of input) {
      if (uniqueValues.has(i)) {
        repeats.add(i);
      } else {
        uniqueValues.add(i);
      }
    }

    if (repeats.size > 0) {
      return {
        constraintType: "uniqueItems",
        path: path,
        failureValue: [...repeats].sort(),
      };
    }

    return null;
  }
}
