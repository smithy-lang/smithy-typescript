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

import {LengthTests} from "@aws-smithy/typescript-integ-test-types";

describe("length constraints", () => {
    it("work for strings", () => {
        expect(LengthTests.validate({ minMaxLengthString: "much longer than 7" })).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 7 ],
            failureValue: 18,
            memberName: "minMaxLengthString",
        }]);
        expect(LengthTests.validate({ minMaxLengthString: "a" })).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 7 ],
            failureValue: 1,
            memberName: "minMaxLengthString",
        }]);
    });
    it("work for maps", () => {
        expect(LengthTests.validate({ minMaxLengthMap: { "abc": 1 }})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 4 ],
            failureValue: 1,
            memberName: "minMaxLengthMap",
        }]);
        expect(LengthTests.validate({ minMaxLengthMap: { "abc": 1, "bcd": 2, "cde": 3, "def": 4, "efg": 5 }})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 4 ],
            failureValue: 5,
            memberName: "minMaxLengthMap",
        }]);
    });
    it("also work on map keys", () => {
        expect(LengthTests.validate({ minMaxLengthMap: { "a": 1, "bcd": 2, "cde": 3 }})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 7 ],
            failureValue: 1,
            memberName: "minMaxLengthMap",
        }]);
        expect(LengthTests.validate({ minMaxLengthMap: { "abcdefghijk": 5, "bcd": 2, "cde": 3 }})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 7 ],
            failureValue: 11,
            memberName: "minMaxLengthMap",
        }]);
    });
    it("work for lists", () => {
        expect(LengthTests.validate({ minMaxLengthList: ["abc"]})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 4 ],
            failureValue: 1,
            memberName: "minMaxLengthList",
        }]);
        expect(LengthTests.validate({ minMaxLengthList: [ "abc", "bcd", "cde", "def", "efg" ]})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 4 ],
            failureValue: 5,
            memberName: "minMaxLengthList",
        }]);
    });
    it("also work on list values", () => {
        expect(LengthTests.validate({ minMaxLengthList: ["abcdefghijk", "def"]})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 7 ],
            failureValue: 11,
            memberName: "minMaxLengthList",
        }]);
    });
    it("work for blobs", () => {
        expect(LengthTests.validate({ minMaxLengthBlob: Buffer.of(1) })).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 4 ],
            failureValue: 1,
            memberName: "minMaxLengthBlob",
        }]);
        expect(LengthTests.validate({ minMaxLengthBlob: Buffer.of(1, 2, 3, 4, 5)})).toEqual([{
            constraintType: "length",
            constraintValues: [ 2, 4 ],
            failureValue: 5,
            memberName: "minMaxLengthBlob",
        }]);
    });
    it("can be overridden on members", () => {
        expect(LengthTests.validate({ minMaxLengthOverride: "abcdef" })).toEqual([{
            constraintType: "length",
            constraintValues: [ 13, 27 ],
            failureValue: 6,
            memberName: "minMaxLengthOverride",
        }]);
    })
});
