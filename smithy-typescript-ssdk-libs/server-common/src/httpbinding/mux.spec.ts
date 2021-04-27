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
import { HttpBindingMux, UriSpec } from ".";

describe("simple matching", () => {
  const router = new HttpBindingMux<"Test", "A" | "LessSpecificA" | "Greedy" | "MiddleGreedy" | "Delete">([
    new UriSpec("GET", [{ type: "path_literal", value: "a" }, { type: "path" }, { type: "path" }], [], {
      service: "Test",
      operation: "A",
    }),
    new UriSpec("GET", [{ type: "path_literal", value: "a" }, { type: "path" }, { type: "greedy" }], [], {
      service: "Test",
      operation: "LessSpecificA",
    }),
    new UriSpec("GET", [{ type: "path_literal", value: "greedy" }, { type: "greedy" }], [], {
      service: "Test",
      operation: "Greedy",
    }),
    new UriSpec(
      "GET",
      [{ type: "path_literal", value: "mg" }, { type: "greedy" }, { type: "path_literal", value: "z" }],
      [],
      { service: "Test", operation: "MiddleGreedy" }
    ),
    new UriSpec(
      "DELETE",
      [],
      [
        { type: "query_literal", key: "foo", value: "bar" },
        { type: "query", key: "baz" },
      ],
      { service: "Test", operation: "Delete" }
    ),
  ]);

  const matches: { [idx: string]: HttpRequest[] } = {
    "Test#LessSpecificA": [
      new HttpRequest({ method: "GET", path: "/a/b/c/d" }),
      new HttpRequest({ method: "GET", path: "/a/b/c/d/e" }),
    ],
    "Test#A": [
      new HttpRequest({ method: "GET", path: "/a/b/c" }),
      new HttpRequest({ method: "GET", path: "/a/b/c/" }),
      new HttpRequest({ method: "GET", path: "/a/b/c", query: { abc: "def" } }),
      new HttpRequest({ method: "GET", path: "/a/b/c", query: { abc: null } }),
    ],
    "Test#Greedy": [
      new HttpRequest({ method: "GET", path: "/greedy/a/b/c/d" }),
      new HttpRequest({ method: "GET", path: "/greedy/a/b/c/d", query: { abc: "def" } }),
    ],
    "Test#MiddleGreedy": [
      new HttpRequest({ method: "GET", path: "/mg/a/z" }),
      new HttpRequest({ method: "GET", path: "/mg/a/b/c/d/z", query: { abc: "def" } }),
    ],
    "Test#Delete": [
      new HttpRequest({ method: "DELETE", path: "/", query: { foo: "bar", baz: "quux" } }),
      new HttpRequest({ method: "DELETE", path: "/", query: { foo: "bar", baz: null } }),
      new HttpRequest({ method: "DELETE", path: "", query: { foo: "bar", baz: ["quux", "grault"] } }),
    ],
  };

  const misses = [
    new HttpRequest({ method: "POST", path: "/a/b/c" }),
    new HttpRequest({ method: "PUT", path: "/a/b/c" }),
    new HttpRequest({ method: "PATCH", path: "/a/b/c" }),
    new HttpRequest({ method: "OPTIONS", path: "/a/b/c" }),
    new HttpRequest({ method: "GET", path: "/a" }),
    new HttpRequest({ method: "GET", path: "/a/b" }),
    new HttpRequest({ method: "GET", path: "/greedy" }),
    new HttpRequest({ method: "GET", path: "/greedy/" }),
    new HttpRequest({ method: "GET", path: "/mg" }),
    new HttpRequest({ method: "GET", path: "/mg/q" }),
    new HttpRequest({ method: "GET", path: "/mg/z" }),
    new HttpRequest({ method: "GET", path: "/mg/a/b/z/c" }),
    new HttpRequest({ method: "DELETE", path: "/", query: { foo: ["bar", "corge"], baz: "quux" } }),
    new HttpRequest({ method: "DELETE", path: "/", query: { foo: "bar" } }),
    new HttpRequest({ method: "DELETE", path: "/", query: { baz: "quux" } }),
    new HttpRequest({ method: "DELETE", path: "/" }),
  ];

  for (const key in matches) {
    const reqs = matches[key];
    for (const req of reqs) {
      it(`should match ${JSON.stringify(req)} to ${key}`, () => {
        expect(router.match(req)).toEqual({ service: key.split("#")[0], operation: key.split("#")[1] });
      });
    }
  }

  for (const req of misses) {
    it(`should not match ${JSON.stringify(req)} to anything`, () => {
      expect(router.match(req)).toBeUndefined();
    });
  }
});
