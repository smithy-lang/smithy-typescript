import { CborCodec } from "@smithy/core/cbor";
import { Bird$, ConservationStatus, type Bird } from "@smithy/types-example";
import { describe, expect, test as it } from "vitest";

describe("types-only codegen schema serde", () => {
  it("round-trips a generated shape with a codec", () => {
    const bird: Bird = {
      name: "Eurasian jay",
      scientificClassification: {
        order: "Passeriformes",
        family: "Corvidae",
        genus: "Garrulus",
        species: "Garrulus glandarius",
      },
      measurements: {
        minWingspanCm: 52,
        maxWingspanCm: 58,
        minLengthCm: 32,
        maxLengthCm: 35,
        minWeightGrams: 140,
        maxWeightGrams: 190,
      },
      conservationStatus: ConservationStatus.LEAST_CONCERN,
      tags: ["corvid", "woodland"],
      nest: {
        openCup: {
          placement: "Tree or large shrub",
          primaryMaterial: "Twigs",
          liningMaterial: "Fine roots and hair",
        },
      },
    };
    const codec = new CborCodec();
    const serializer = codec.createSerializer();

    serializer.write(Bird$, bird);
    const serialized = serializer.flush();

    const deserializer = codec.createDeserializer();
    expect(deserializer.read(Bird$, serialized)).toEqual(bird);
  });
});
