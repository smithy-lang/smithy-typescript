import { NormalizedSchema } from "@smithy/core/schema";
import type { StaticStructureSchema, TimestampEpochSecondsSchema } from "@smithy/types";
import { describe, expect, it } from "vitest";

import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

describe(ToStringShapeSerializer.name, () => {
  it("should serialize idempotency tokens automatically", () => {
    const structureWithIdempotencyToken = [
      3,
      "ns",
      "Struct",
      0,
      ["name", "token"],
      [
        0,
        [
          0,
          {
            idempotencyToken: 1,
            httpQuery: "token",
          },
        ],
      ],
    ] satisfies StaticStructureSchema;

    const serializer = new ToStringShapeSerializer({
      httpBindings: true,
      timestampFormat: {
        default: 7 satisfies TimestampEpochSecondsSchema,
        useTrait: true,
      },
    });

    const ns = NormalizedSchema.of(structureWithIdempotencyToken);

    serializer.write(ns.getMemberSchema("token"), undefined);
    {
      const serialization = serializer.flush();
      expect(serialization).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});
