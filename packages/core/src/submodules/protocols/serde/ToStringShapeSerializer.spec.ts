import { NormalizedSchema } from "@smithy/core/schema";
import type {
  CodecSettings,
  ListSchemaModifier,
  StaticStructureSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, it, vi } from "vitest";

import { HttpBindingNormalizedSchema } from "../HttpBindingNormalizedSchema";
import { FromStringShapeDeserializer } from "./FromStringShapeDeserializer";
import { ToStringShapeSerializer } from "./ToStringShapeSerializer";

describe(ToStringShapeSerializer.name, () => {
  const settings = {
    httpBindings: true,
    timestampFormat: {
      default: 7 satisfies TimestampEpochSecondsSchema,
      useTrait: true,
    },
  } satisfies CodecSettings;

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

    const serializer = new ToStringShapeSerializer(settings);

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
    const [, value, location] = HttpBindingNormalizedSchema.of(structure).getHttpBindings()[0];
    vi.spyOn(value[0], "getMergedTraits").mockImplementation(() => {
      throw new Error("unexpected trait lookup");
    });
    const serializer = new ToStringShapeSerializer(settings);

    serializer.writeHttpBinding(value, new Date(1000), location);

    expect(serializer.flush()).toBe("1");
    expect(new FromStringShapeDeserializer(settings).readHttpBinding(value, "1", location)).toEqual(new Date(1000));
  });

  it("ignores cached HTTP timestamp formats when HTTP bindings are disabled", () => {
    const structure = [
      3,
      "ns",
      "Struct",
      0,
      ["value"],
      [[4 satisfies TimestampDefaultSchema, { httpHeader: "x-value" }]],
    ] satisfies StaticStructureSchema;
    const [, value, location] = HttpBindingNormalizedSchema.of(structure).getHttpBindings()[0];
    const nonHttpSettings = { ...settings, httpBindings: false };
    const serializer = new ToStringShapeSerializer(nonHttpSettings);

    serializer.writeHttpBinding(value, new Date(1000), location);

    expect(serializer.flush()).toBe("1");
    expect(new FromStringShapeDeserializer(nonHttpSettings).readHttpBinding(value, "1", location)).toEqual(
      new Date(1000)
    );
  });

  it("supports traitless string lists", () => {
    const schema = (64 satisfies ListSchemaModifier) | (0 satisfies StringSchema);
    const serializer = new ToStringShapeSerializer(settings);

    serializer.write(schema, ["a", "b"]);

    expect(serializer.flush()).toBe("a, b");
    expect(new FromStringShapeDeserializer(settings).read(schema, "a,b")).toEqual(["a", "b"]);
  });
});
