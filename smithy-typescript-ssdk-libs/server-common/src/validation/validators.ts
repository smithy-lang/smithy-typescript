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

  validate(input: T | undefined | null, memberName: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    for (const v of this.validators) {
      const failure = v.validate(input, memberName);
      if (failure) {
        retVal.push(failure);
      }
    }
    return retVal;
  }
}

export class CompositeStructureValidator<T> implements MultiConstraintValidator<T> {
  private readonly referenceValidator: CompositeValidator<T>;
  private readonly structureValidator: (input: T) => ValidationFailure[];

  constructor(referenceValidator: CompositeValidator<T>, structureValidator: (input: T) => ValidationFailure[]) {
    this.referenceValidator = referenceValidator;
    this.structureValidator = structureValidator;
  }

  validate(input: T | undefined | null, memberName: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    retVal.push(...this.referenceValidator.validate(input, memberName));
    if (input !== null && input !== undefined) {
      retVal.push(...this.structureValidator(input));
    }
    return retVal;
  }
}

export class CompositeCollectionValidator<T> implements MultiConstraintValidator<Iterable<T>> {
  private readonly referenceValidator: CompositeValidator<Iterable<T>>;
  private readonly memberValidator: MultiConstraintValidator<T>;

  constructor(referenceValidator: CompositeValidator<Iterable<T>>, memberValidator: MultiConstraintValidator<T>) {
    this.referenceValidator = referenceValidator;
    this.memberValidator = memberValidator;
  }

  validate(input: Iterable<T> | undefined | null, memberName: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    retVal.push(...this.referenceValidator.validate(input, memberName));
    if (input !== null && input !== undefined) {
      for (const member of input) {
        retVal.push(...this.memberValidator.validate(member, memberName));
      }
    }
    return retVal;
  }
}

export class CompositeMapValidator<T> implements MultiConstraintValidator<{ [key: string]: T }> {
  private readonly referenceValidator: CompositeValidator<{ [key: string]: T }>;
  private readonly keyValidator: MultiConstraintValidator<string>;
  private readonly valueValidator: MultiConstraintValidator<T>;

  constructor(
    referenceValidator: CompositeValidator<{ [key: string]: T }>,
    keyValidator: MultiConstraintValidator<string>,
    valueValidator: MultiConstraintValidator<T>
  ) {
    this.referenceValidator = referenceValidator;
    this.keyValidator = keyValidator;
    this.valueValidator = valueValidator;
  }

  validate(input: { [key: string]: T } | undefined | null, memberName: string): ValidationFailure[] {
    const retVal: ValidationFailure[] = [];
    retVal.push(...this.referenceValidator.validate(input, memberName));
    if (input !== null && input !== undefined) {
      Object.keys(input).forEach((key) => {
        const value = input[key];
        retVal.push(...this.keyValidator.validate(key, memberName));
        retVal.push(...this.valueValidator.validate(value, memberName));
      });
    }
    return retVal;
  }
}

export class NoOpValidator extends CompositeValidator<any> {
  constructor() {
    super([]);
  }

  validate(input: any, memberName: string): ValidationFailure[] {
    return [];
  }
}

export interface MultiConstraintValidator<T> {
  validate(input: T, memberName: string): ValidationFailure[];
}

export interface SingleConstraintValidator<T, F> {
  validate(input: T | undefined | null, memberName: string): F | null;
}

export class EnumValidator implements SingleConstraintValidator<string, EnumValidationFailure> {
  private readonly allowedValues: string[];

  constructor(allowedValues: readonly string[]) {
    this.allowedValues = allowedValues.slice();
  }

  validate(input: string | undefined | null, memberName: string): EnumValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    if (this.allowedValues.indexOf(input) < 0) {
      return {
        constraintType: "enum",
        constraintValues: this.allowedValues.slice(),
        memberName: memberName,
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

  validate(input: LengthCheckable | undefined | null, memberName: string): LengthValidationFailure | null {
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
        memberName: memberName,
        failureValue: length,
      };
    }

    return null;
  }

  private static hasLength<P extends PropertyKey>(obj: any): obj is { length: number } {
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

  validate(input: number | undefined | null, memberName: string): RangeValidationFailure | null {
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
        memberName: memberName,
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

  validate(input: string | undefined | null, memberName: string): PatternValidationFailure | null {
    if (input === null || input === undefined) {
      return null;
    }

    if (!input.match(this.pattern)) {
      return {
        constraintType: "pattern",
        constraintValues: this.inputPattern,
        failureValue: input,
        memberName: memberName,
      };
    }
    return null;
  }
}

export class RequiredValidator implements SingleConstraintValidator<any, RequiredValidationFailure> {
  validate(input: any, memberName: string): RequiredValidationFailure | null {
    if (input === null || input === undefined) {
      return new RequiredValidationFailure(memberName);
    }
    return null;
  }
}

export class UniqueItemsValidator implements SingleConstraintValidator<Array<any>, UniqueItemsValidationFailure> {
  validate(input: Array<any> | undefined | null, memberName: string): UniqueItemsValidationFailure | null {
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
        memberName: memberName,
        failureValue: [...repeats].sort(),
      };
    }

    return null;
  }
}
