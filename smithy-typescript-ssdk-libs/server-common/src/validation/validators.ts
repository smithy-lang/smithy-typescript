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
    ValidationFailure
} from ".";

export class CompositeValidator<T> {
    private readonly validators: Validator<T, any>[];

    constructor(validators: Validator<T, any>[]) {
        this.validators = validators;
    }

    validate(input: T | undefined | null, memberName: string): ValidationFailure[] {
        let retVal: ValidationFailure[] = [];
        for (let v of this.validators) {
            let failure = v.validate(input, memberName);
            if (failure) {
                retVal.push(failure);
            }
        }
        return retVal;
    }
}

export class NullValidator {
    validate(input: any, memberName: string): ValidationFailure[] {
        return [];
    }
}

export interface Validator<T, F> {
    validate(input: T | undefined | null, memberName: string): F | null;
}

export class EnumValidator implements Validator<string, EnumValidationFailure> {
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
                constraintType: 'enum',
                constraintValues: this.allowedValues.slice(),
                memberName: memberName,
                failureValue: input
            }
        }

        return null;
    }

}

type LengthCheckable = { length: number } | { [key: string]: any };

export class LengthValidator implements Validator<LengthCheckable, LengthValidationFailure> {
    private readonly min?: number;
    private readonly max?: number;

    constructor(min?: number, max?: number) {
        if (min === undefined && max === undefined) {
            throw new Error('Length constraints must have at least a min or a max.');
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

        if (this.min !== undefined && length < this.min || this.max !== undefined && length > this.max) {
            return {
                constraintType: 'length',
                constraintValues: this.min === undefined ? [undefined, this.max!]
                                    : this.max === undefined ? [this.min!, undefined]
                                    : [this.min!, this.max!],
                memberName: memberName,
                failureValue: length
            }
        }

        return null;
    }

    private static hasLength<P extends PropertyKey>(obj: any): obj is { length: number } {
        return obj.hasOwnProperty("length")
    }
}

export class RangeValidator implements Validator<number, RangeValidationFailure> {
    private readonly min?: number;
    private readonly max?: number;

    constructor(min?: number, max?: number) {
        if (min === undefined && max === undefined) {
            throw new Error('Range constraints must have at least a min or a max.');
        }
        this.min = min;
        this.max = max;
    }

    validate(input: number | undefined | null, memberName: string): RangeValidationFailure | null {
        if (input === null || input === undefined) {
            return null;
        }

        if (this.min !== undefined && input < this.min || this.max !== undefined && input > this.max) {
            return {
                constraintType: 'range',
                constraintValues: this.min === undefined ? [undefined, this.max!]
                    : this.max === undefined ? [this.min!, undefined]
                        : [this.min!, this.max!],
                memberName: memberName,
                failureValue: input
            }
        }

        return null;
    }
}

export class PatternValidator implements Validator<string, PatternValidationFailure> {
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
                constraintType: 'pattern',
                constraintValues: this.inputPattern,
                failureValue: input,
                memberName: memberName
            }
        }
        return null;
    }
}

export class RequiredValidator implements Validator<any, RequiredValidationFailure> {
    validate(input: any, memberName: string) : RequiredValidationFailure | null {
        if (input === null || input === undefined) {
            return new RequiredValidationFailure(memberName);
        }
        return null;
    }
}

export class UniqueItemsValidator implements Validator<Array<any>, UniqueItemsValidationFailure> {

    validate(input: Array<any> | undefined | null, memberName: string): UniqueItemsValidationFailure | null {
        if (input === null || input === undefined) {
            return null;
        }

        let repeats = new Set<any>();
        let uniqueValues = new Set<any>();
        for (let i of input) {
            if (uniqueValues.has(i)) {
                repeats.add(i);
            } else {
                uniqueValues.add(i);
            }
        }

        if (repeats.size > 0) {
            return {
                constraintType: 'uniqueItems',
                memberName: memberName,
                failureValue: [...repeats].sort()
            }
        }

        return null;
    }
}