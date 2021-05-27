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

import { HttpRequest } from "@aws-sdk/protocol-http";
import { ValidationContext, ValidationFailure } from "@aws-smithy/server-common";
import {
  CustomValidationError,
  CustomValidationErrorError,
  getTestHandler,
} from "@aws-smithy/typescript-integ-test-custom-validation";
import { Readable } from "stream";

const testHandler = getTestHandler(
  async () => {
    return { $metadata: {} };
  },
  (context: ValidationContext<"Test">, failures: ValidationFailure[]): CustomValidationError | undefined => {
    if (!failures) {
      return undefined;
    }
    return new CustomValidationErrorError({
      failingPaths: Array.from(new Set(failures.map((f) => f.path))),
      totalFailures: failures.length,
    });
  }
);

describe("custom validation", () => {
  it("does not fail valid requests", () => {
    return testHandler
      .handle(
        new HttpRequest({
          method: "POST",
          path: "/test",
          body: Readable.from(Buffer.from('{"enum": "valueA"}', "utf8")),
        })
      )
      .then((result) => {
        expect(result.statusCode).toEqual(200);
      });
  });
  it("fails invalid requests", () => {
    return testHandler
      .handle(
        new HttpRequest({
          method: "POST",
          path: "/test",
          body: Readable.from(Buffer.from('{"enumList": ["BANG!", "POW!", "valueA"]}', "utf8")),
        })
      )
      .then((result) => {
        expect(result.statusCode).toEqual(400);
        expect(result.headers["x-amzn-errortype"]).toEqual("CustomValidationError");
        const parsedBody = JSON.parse(result.body);
        expect(parsedBody.failingPaths).toEqual(["/enumList", "/enumList/0", "/enumList/1"]);
        expect(parsedBody.totalFailures).toEqual(3);
      });
  });
});
