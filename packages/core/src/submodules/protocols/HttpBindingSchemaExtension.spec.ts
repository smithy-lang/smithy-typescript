import { NormalizedSchema, op } from "@smithy/core/schema";
import type { ListSchemaModifier, MapSchemaModifier, StaticStructureSchema, StringSchema } from "@smithy/types";
import { describe, expect, it } from "vitest";

import {
  getHttpBindings,
  getHttpOperationBindings,
  hasHttpBindingUnstructuredPayload,
  resolveHttpBindingContentType,
} from "./HttpBindingSchemaExtension";

const struct = (name: string, members: Record<string, any>) =>
  [3, "example", name, 0, Object.keys(members), Object.values(members)] as StaticStructureSchema;

describe("HTTP binding schema extension", () => {
  const structure = struct("Bindings", {
    body: 0,
    label: [0, { httpLabel: 1, hostLabel: 1 }],
    header: [0, { httpHeader: "X-Test" }],
    prefix: [[2, "example", "Headers", 0, 0, 0], { httpPrefixHeaders: "X-Meta-" }],
    query: [0, { httpQuery: "q" }],
    queryParams: [(128 satisfies MapSchemaModifier) | (0 satisfies StringSchema), { httpQueryParams: 1 }],
    payload: [21, { httpPayload: 1 }],
    status: [1, { httpResponseCode: 1 }],
  });

  it("caches member binding information on the structure schema", () => {
    const first = getHttpBindings(NormalizedSchema.of(structure));

    expect(getHttpBindings(NormalizedSchema.of(() => structure))).toBe(first);
    expect((structure as any)[Symbol.for("@smithy/schema-x")]).toBe(first);
    expect(first.map(([, , location]) => location)).toEqual([
      0b100_000, 0b100_001, 0b100_110, 0b100_111, 0b100_010, 0b100_011, 0b100_100, 0b100_101,
    ]);
    expect(first.map(([, , , wireName]) => wireName).filter(Boolean)).toEqual(["x-test", "x-meta-", "q"]);
    expect(Array.from(first.responseBody)).toEqual(["body", "label", "query", "queryParams"]);
    expect(first.responseBody.schema?.[4]).toEqual(["body", "label", "query", "queryParams"]);
    expect(first.schema?.[4]).toEqual(["body"]);
    expect(first.responseBody.discardResponseBody).toBe(false);
    expect(first.responsePayload).toBe(first[6]);
    expect(first.responseCode).toBe(first[7]);
    expect(first.responseHeaders["x-test"]).toBe(first[2]);
    expect(first.responsePrefixHeaders).toEqual([first[3]]);
    expect((first[1][1][1] >> 17) & 1).toBe(1);
  });

  it("resolves content types and payload kinds from the cached binding", () => {
    const schema = NormalizedSchema.of(structure);
    expect(resolveHttpBindingContentType("application/json", schema)).toBe("application/octet-stream");
    expect(hasHttpBindingUnstructuredPayload(schema)).toBe(true);

    const document = NormalizedSchema.of(struct("Document", { value: 0 }));
    expect(resolveHttpBindingContentType("application/json", document)).toBe("application/json");
    expect(hasHttpBindingUnstructuredPayload(document)).toBe(false);
    expect(getHttpBindings(document).responseBody.discardResponseBody).toBe(true);
  });

  it("caches operation HTTP and endpoint traits", () => {
    const operation = op(
      "example",
      "Operation",
      {
        http: ["PUT", "/{bucket}/{key+}?acl=", 200],
        endpoint: ["{bucket}."],
      },
      structure,
      "unit"
    );
    const first = getHttpOperationBindings(operation);

    expect(getHttpOperationBindings(operation)).toBe(first);
    expect(first).toEqual([
      "PUT",
      "/{bucket}/{key+}",
      [["acl", ""]],
      [
        ["/", 0],
        ["bucket", 1],
        ["/", 0],
        ["key", 2],
      ],
      "{bucket}.",
    ]);
  });

  it("caches value type and trait flags", () => {
    const schema = NormalizedSchema.of(
      struct("Values", {
        token: [0, { httpHeader: "X-Token", idempotencyToken: 1, mediaType: "application/json" }],
        dates: [(64 satisfies ListSchemaModifier) | 4, { httpHeader: "X-Dates" }],
        sparse: [(64 satisfies ListSchemaModifier) | 0, { httpQuery: "sparse", sparse: 1 }],
        stream: [42, { httpPayload: 1 }],
        events: [[3, "example", "Events", { streaming: 1 }, [], []], { httpPayload: 1 }],
      })
    );
    const [token, dates, sparse, stream, events] = getHttpBindings(schema);

    expect(token[1][1] & 0xff).toBe(0);
    expect((token[1][1] >> 8) & 0b11).toBe(2);
    expect((token[1][1] >> 10) & 1).toBe(1);
    expect(dates[1][1] & 0b1100_0000).toBe(0b0100_0000);
    expect((dates[1][2]![1] >> 14) & 0b11).toBe(2);
    expect((dates[1][1] >> 16) & 1).toBe(1);
    expect(dates[1][2]?.[1] && dates[1][2][1] & 0xff).toBe(4);
    expect((sparse[1][1] >> 13) & 1).toBe(1);
    expect((stream[1][1] >> 11) & 0b11).toBe(1);
    expect((events[1][1] >> 11) & 0b11).toBe(2);
  });
});
