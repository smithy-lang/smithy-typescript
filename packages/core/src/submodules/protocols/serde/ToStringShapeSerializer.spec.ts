import { NormalizedSchema } from "@smithy/core/schema";
import type {
  CodecSettings,
  StaticStructureSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, it, vi } from "vitest";

import { getHttpBindings } from "../HttpBindingSchemaExtension";
import { FromStringShapeDeserializer } from "./FromStringShapeDeserializer";
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

  it("uses cached value metadata without reading traits", () => {
    const structure = [
      3,
      "ns",
      "Struct",
      0,
      ["value"],
      [[4 satisfies TimestampDefaultSchema, { httpPayload: 1 }]],
    ] satisfies StaticStructureSchema;
    const [, value, location] = getHttpBindings(NormalizedSchema.of(structure))[0];
    vi.spyOn(value[0], "getMergedTraits").mockImplementation(() => {
      throw new Error("unexpected trait lookup");
    });
    const settings = {
      httpBindings: true,
      timestampFormat: {
        default: 7 satisfies TimestampEpochSecondsSchema,
        useTrait: true,
      },
    } satisfies CodecSettings;
    const serializer = new ToStringShapeSerializer(settings);

    serializer.writeHttpBinding(value, new Date(1000), location);

    expect(serializer.flush()).toBe("1");
    expect(new FromStringShapeDeserializer(settings).readHttpBinding(value, "1", location)).toEqual(new Date(1000));
  });
});
