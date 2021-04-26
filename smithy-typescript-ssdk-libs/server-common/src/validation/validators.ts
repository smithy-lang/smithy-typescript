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

import { EnumValidationFailure, LengthValidationFailure, PatternValidationFailure, UniqueItemsValidationFailure } from ".";

export class EnumValidator {
    private readonly allowedValues: string[];

    constructor(allowedValues: readonly string[]) {
        this.allowedValues = allowedValues.slice();
    }

    validate(input: string, memberName: string): EnumValidationFailure | null {
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

export class LengthValidator {
    private readonly min?: number;
    private readonly max?: number;

    constructor(min?: number, max?: number) {
        if (min === undefined && max === undefined) {
            throw new Error('Length constraints must have at least a min or a max.');
        }
        this.min = min;
        this.max = max;
    }

    validate(input: { length: number } | { [key: string]: any }, memberName: string): LengthValidationFailure | null {
        let length: number;
        if (LengthValidator.hasProperty(input, 'length')) {
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

    private static hasProperty<P extends PropertyKey>(obj: any, prop: P): obj is Record<P, unknown> {
        return obj.hasOwnProperty(prop)
    }
}

export class RangeValidator {
    private readonly min?: number;
    private readonly max?: number;

    constructor(min?: number, max?: number) {
        if (min === undefined && max === undefined) {
            throw new Error('Range constraints must have at least a min or a max.');
        }
        this.min = min;
        this.max = max;
    }

    validate(input: number, memberName: string) {
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

export class PatternValidator {
    private readonly inputPattern: string;
    private readonly pattern: RegExp;

    constructor(pattern: string) {
        this.inputPattern = pattern;
        this.pattern = new RegExp(pattern, "u");
    }

    validate(input: string, memberName: string): PatternValidationFailure | null {
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

export class UniqueItemsValidator {

    validate(input: Array<any>, memberName: string): UniqueItemsValidationFailure | null {
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