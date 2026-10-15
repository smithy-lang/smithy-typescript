import { NormalizedSchema, op } from "@smithy/core/schema";
import type { ListSchemaModifier, MapSchemaModifier, StaticStructureSchema, StringSchema } from "@smithy/types";
import { describe, expect, it } from "vitest";

import {
  getHttpOperationBindingExtension,
  getHttpStructBindingExtension,
  hasHttpBindingUnstructuredPayload,
  HttpBindingLocation,
  HttpBindingValueKind,
  HttpPathSegmentKind,
  resolveHttpBindingContentType,
} from "./HttpBindingSchemaExtension";

describe("HTTP binding schema extensions", () => {
  const structure = [
    3,
    "example",
    "Bindings",
    0,
    ["bodyRequired", "label", "header", "prefix", "query", "queryParams", "payload", "status", "body"],
    [
      0,
      [0, { httpLabel: 1 }],
      [0, { httpHeader: "X-Test" }],
      [[2, "example", "Headers", 0, 0, 0], { httpPrefixHeaders: "X-Meta-" }],
      [0, { httpQuery: "q" }],
      [(128 satisfies MapSchemaModifier) | (0 satisfies StringSchema), { httpQueryParams: 1 }],
      [21, { httpPayload: 1 }],
      [1, { httpResponseCode: 1 }],
      0,
    ],
    3,
  ] satisfies StaticStructureSchema;

  it("caches direction-specific structure bindings and filtered body schemas", () => {
    const extension = getHttpStructBindingExtension(NormalizedSchema.of(structure));
    const request = extension.request();
    const response = extension.response();

    expect(extension.request()).toBe(request);
    expect(extension.response()).toBe(response);
    expect(request.members.map((binding) => binding.location)).toEqual([
      HttpBindingLocation.BODY,
      HttpBindingLocation.LABEL,
      HttpBindingLocation.HEADER,
      HttpBindingLocation.PREFIX_HEADERS,
      HttpBindingLocation.QUERY,
      HttpBindingLocation.QUERY_PARAMS,
      HttpBindingLocation.PAYLOAD,
      HttpBindingLocation.BODY,
      HttpBindingLocation.BODY,
    ]);
    expect(request.members[2].wireName).toBe("x-test");
    expect(request.members[3].wireName).toBe("x-meta-");
    expect(Object.keys(request.labelNames)).toEqual(["label"]);
    expect(request.bodySchema?.[4]).toEqual(["bodyRequired", "status", "body"]);
    expect(request.bodySchema?.[6]).toBe(1);
    expect(request.contentType).toBe("application/octet-stream");
    expect(request.hasUnstructuredPayload).toBe(true);
    expect(resolveHttpBindingContentType("application/json", NormalizedSchema.of(structure))).toBe(
      "application/octet-stream"
    );
    expect(hasHttpBindingUnstructuredPayload(NormalizedSchema.of(structure))).toBe(true);

    expect(
      Object.values(response.scalarHeadersByName).map(({ memberName, wireName }) => [memberName, wireName])
    ).toEqual([["header", "x-test"]]);
    expect(response.scalarHeaderCount).toBe(1);
    expect(response.listHeaders).toEqual([]);
    expect(response.prefixHeaders.map(({ memberName, prefix }) => [memberName, prefix])).toEqual([
      ["prefix", "x-meta-"],
    ]);
    expect(response.payloadMember?.memberName).toBe("payload");
    expect(response.responseCodeMember).toBe("status");
    expect([...response.bodyMemberNames]).toEqual(["bodyRequired", "label", "query", "queryParams", "body"]);
    expect(response.bodySchema?.[4]).toEqual(response.bodyMemberNames);
    expect(response.bodySchema?.[6]).toBe(2);
  });

  it("shares structure extensions across wrappers of the same static schema", () => {
    const first = getHttpStructBindingExtension(NormalizedSchema.of(() => structure));
    const second = getHttpStructBindingExtension(NormalizedSchema.of(() => structure));

    expect(second).toBe(first);
  });

  it("caches parsed operation HTTP bindings", () => {
    const operation = op(
      "example",
      "GetThing",
      { http: ["GET", "/things/{id}?fixed=yes&flag=", 204] },
      structure,
      "unit"
    );

    const first = getHttpOperationBindingExtension(operation);
    const second = getHttpOperationBindingExtension(operation);

    expect(second).toBe(first);
    expect(first).toEqual({
      method: "GET",
      path: "/things/{id}",
      pathSegments: [
        ["/things/", HttpPathSegmentKind.LITERAL],
        ["id", HttpPathSegmentKind.LABEL],
      ],
      query: [
        ["fixed", "yes"],
        ["flag", ""],
      ],
    });
  });

  it("caches literal, label, and greedy-label URI path segments", () => {
    const operation = op(
      "example",
      "GetThing",
      { http: ["GET", "/root/{id}/nested/{path+}/tail", 200] },
      structure,
      "unit"
    );

    expect(getHttpOperationBindingExtension(operation).pathSegments).toEqual([
      ["/root/", HttpPathSegmentKind.LITERAL],
      ["id", HttpPathSegmentKind.LABEL],
      ["/nested/", HttpPathSegmentKind.LITERAL],
      ["path", HttpPathSegmentKind.GREEDY_LABEL],
      ["/tail", HttpPathSegmentKind.LITERAL],
    ]);
  });

  it("separates scalar and list response header dispatch data", () => {
    const schema = NormalizedSchema.of([
      3,
      "example",
      "Headers",
      0,
      ["scalar", "list"],
      [
        [0, { httpHeader: "X-Scalar" }],
        [(64 satisfies ListSchemaModifier) | (0 satisfies StringSchema), { httpHeader: "X-List" }],
      ],
    ] satisfies StaticStructureSchema);
    const response = getHttpStructBindingExtension(schema).response();

    expect(Object.keys(response.scalarHeadersByName)).toEqual(["x-scalar"]);
    expect(response.listHeaders.map(({ memberName, wireName }) => [memberName, wireName])).toEqual([
      ["list", "x-list"],
    ]);
  });

  it("caches HTTP value formatting and payload metadata", () => {
    const schema = NormalizedSchema.of([
      3,
      "example",
      "Formatting",
      0,
      ["timestampHeader", "timestampQuery", "timestampList", "jsonHeader", "payload"],
      [
        [4, { httpHeader: "X-Time" }],
        [4, { httpQuery: "time" }],
        [(64 satisfies ListSchemaModifier) | 4, { httpHeader: "X-Times" }],
        [0, { httpHeader: "X-Json", mediaType: "application/json" }],
        [42, { httpPayload: 1 }],
      ],
    ] satisfies StaticStructureSchema);
    const request = getHttpStructBindingExtension(schema).request();
    const response = getHttpStructBindingExtension(schema).response();

    expect(request.members[0].valueMetadata).toMatchObject({
      kind: HttpBindingValueKind.TIMESTAMP,
      timestampFormat: 6,
    });
    expect(request.members[1].valueMetadata).toMatchObject({
      kind: HttpBindingValueKind.TIMESTAMP,
      timestampFormat: 5,
    });
    expect(request.members[2].valueMetadata).toMatchObject({
      kind: HttpBindingValueKind.LIST,
      listValueMetadata: {
        kind: HttpBindingValueKind.TIMESTAMP,
        timestampFormat: 6,
      },
    });
    expect(request.members[3].valueMetadata).toMatchObject({
      kind: HttpBindingValueKind.STRING,
      mediaType: "application/json",
      isJsonMediaType: true,
    });
    expect(request.members[4].valueMetadata).toMatchObject({
      kind: HttpBindingValueKind.BLOB,
      isStreaming: true,
      isEventStream: false,
    });
    expect(response.listHeaders[0].listValueMetadata).toMatchObject({
      kind: HttpBindingValueKind.TIMESTAMP,
      timestampFormat: 6,
    });
  });

  it.each([
    {
      name: "modeled media type",
      member: [0, { httpPayload: 1, mediaType: "application/custom" }],
      expected: "application/custom",
      unstructured: true,
    },
    {
      name: "string payload",
      member: [0, { httpPayload: 1 }],
      expected: "text/plain",
      unstructured: true,
    },
    {
      name: "blob payload",
      member: [21, { httpPayload: 1 }],
      expected: "application/octet-stream",
      unstructured: true,
    },
    {
      name: "structured payload",
      member: [[3, "example", "Payload", 0, [], []], { httpPayload: 1 }],
      expected: "application/json",
      unstructured: false,
    },
    {
      name: "document body",
      member: 0,
      expected: "application/json",
      unstructured: false,
    },
    {
      name: "no body",
      member: [0, { httpHeader: "x-value" }],
      expected: undefined,
      unstructured: false,
    },
  ])("caches content-type metadata for $name", ({ member, expected, unstructured }) => {
    const schema = NormalizedSchema.of([3, "example", "ContentType", 0, ["value"], [member]] as StaticStructureSchema);

    expect(resolveHttpBindingContentType("application/json", schema)).toBe(expected);
    expect(hasHttpBindingUnstructuredPayload(schema)).toBe(unstructured);
  });

  it("does not assign a content type to unit input", () => {
    const schema = NormalizedSchema.of("unit");

    expect(resolveHttpBindingContentType("application/json", schema)).toBeUndefined();
    expect(hasHttpBindingUnstructuredPayload(schema)).toBe(false);
  });
});
