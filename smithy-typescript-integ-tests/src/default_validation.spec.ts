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
import { getTestHandler } from "@aws-smithy/typescript-integ-test-types";
import { Readable } from "stream";

const testHandler = getTestHandler(async () => {
  return { $metadata: {} };
});

describe("automatic validation", () => {
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
          body: Readable.from(Buffer.from('{"enum": "BANG!"}', "utf8")),
        })
      )
      .then((result) => {
        expect(result.statusCode).toEqual(400);
        expect(result.headers["x-amzn-errortype"]).toEqual("ValidationException");
        const parsedBody = JSON.parse(result.body);
        expect(parsedBody.message).toContain("1 validation error detected");
        expect(parsedBody.fieldList).toHaveLength(1);
        expect(parsedBody.fieldList[0].path).toEqual("/enum");
        expect(parsedBody.fieldList[0].message).toEqual(
          "Value BANG! at '/enum' failed to satisfy constraint: Member must satisfy enum value set: valueA,valueB"
        );
      });
  });
  it("does not return sensitive member values", () => {
      return testHandler
          .handle(
              new HttpRequest({
                  method: "POST",
                  path: "/test",
                  body: Readable.from(Buffer.from('{"sensitiveMember": "abcdefg"}', "utf8")),
              })
          )
          .then((result) => {
              expect(result.statusCode).toEqual(400);
              expect(result.headers["x-amzn-errortype"]).toEqual("ValidationException");
              const parsedBody = JSON.parse(result.body);
              expect(parsedBody.message).toContain("1 validation error detected");
              expect(parsedBody.fieldList).toHaveLength(1);
              expect(parsedBody.fieldList[0].path).toEqual("/sensitiveMember");
              expect(parsedBody.fieldList[0].message).toEqual(
                  "Value at '/sensitiveMember' failed to satisfy constraint: Member must have length less than or equal to 5"
              );
          });
  });
});
