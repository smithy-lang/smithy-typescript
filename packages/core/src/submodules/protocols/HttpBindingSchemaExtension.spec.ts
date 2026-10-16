import { NormalizedSchema } from "@smithy/core/schema";
import type { MapSchemaModifier, StaticStructureSchema, StringSchema } from "@smithy/types";
import { describe, expect, it } from "vitest";

import {
  getHttpBindings,
  hasHttpBindingUnstructuredPayload,
  resolveHttpBindingContentType,
  type HttpBody,
  type HttpHeader,
  type HttpLabel,
  type HttpPayload,
  type HttpPrefixHeaders,
  type HttpQuery,
  type HttpQueryParams,
  type HttpResponseCode,
} from "./HttpBindingSchemaExtension";

describe("HTTP binding schema extension", () => {
  const structure = [
    3,
    "example",
    "Bindings",
    0,
    ["body", "label", "header", "prefix", "query", "queryParams", "payload", "status"],
    [
      0,
      [0, { httpLabel: 1 }],
      [0, { httpHeader: "X-Test" }],
      [[2, "example", "Headers", 0, 0, 0], { httpPrefixHeaders: "X-Meta-" }],
      [0, { httpQuery: "q" }],
      [(128 satisfies MapSchemaModifier) | (0 satisfies StringSchema), { httpQueryParams: 1 }],
      [21, { httpPayload: 1 }],
      [1, { httpResponseCode: 1 }],
    ],
  ] satisfies StaticStructureSchema;

  it("caches member binding information on the structure schema", () => {
    const first = getHttpBindings(NormalizedSchema.of(structure));
    const second = getHttpBindings(NormalizedSchema.of(() => structure));

    expect(second).toBe(first);
    expect((structure as any)[Symbol.for("@smithy/schema-x")]).toBe(first);
    expect(first.map(([name, , location, wireName]) => [name, location, wireName])).toEqual([
      ["body", 0 satisfies HttpBody, undefined],
      ["label", 3 satisfies HttpLabel, undefined],
      ["header", 1 satisfies HttpHeader, "x-test"],
      ["prefix", 5 satisfies HttpPrefixHeaders, "x-meta-"],
      ["query", 2 satisfies HttpQuery, "q"],
      ["queryParams", 6 satisfies HttpQueryParams, undefined],
      ["payload", 4 satisfies HttpPayload, undefined],
      ["status", 7 satisfies HttpResponseCode, undefined],
    ]);
  });

  it("resolves payload content types from the cached binding", () => {
    const schema = NormalizedSchema.of(structure);

    expect(resolveHttpBindingContentType("application/json", schema)).toBe("application/octet-stream");
    expect(hasHttpBindingUnstructuredPayload(schema)).toBe(true);
  });

  it("uses the protocol content type for document bodies", () => {
    const schema = NormalizedSchema.of([3, "example", "Document", 0, ["value"], [0]] as StaticStructureSchema);

    expect(resolveHttpBindingContentType("application/json", schema)).toBe("application/json");
    expect(hasHttpBindingUnstructuredPayload(schema)).toBe(false);
  });
});
