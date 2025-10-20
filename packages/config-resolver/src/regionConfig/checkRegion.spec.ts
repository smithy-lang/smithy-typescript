import { describe, test as it, expect, vi } from "vitest";
import { isValidHostLabel } from "@smithy/util-endpoints";
import { checkRegion } from "./checkRegion";

describe("checkRegion", () => {
  const acceptedRegionExamples = [
    "us-east-1",
    "ap-east-1",
    "ap-southeast-4",
    "ap-northeast-3",
    "ap-northeast-1",
    "eu-west-2",
    "il-central-1",
    "mx-central-1",
    "eu-isoe-santaclaus-125",
    "us-iso-reindeer-3000",
    "eusc-de-gingerbread-8000",
    "abcd",
    "12345",
  ];

  it("does not throw when the region is a valid host label", () => {
    for (const region of acceptedRegionExamples) {
      expect(() => checkRegion(region)).not.toThrow();
    }
  });

  it("throws when the region is not a valid host label", () => {
    for (const region of [
      "us-east-1-",
      "a".repeat(64),
      "-us-east-1",
      "",
      "!",
      "@",
      "#",
      "$",
      "%",
      "^",
      "&",
      "*",
      "(",
      ")",
      ".",
      "[",
      "]",
      ";",
      `'`,
      "?",
      "/",
      "\\",
      "|",
      "+-*/",
    ]) {
      expect(() => checkRegion(region)).toThrow(
        `Region not accepted: region="${region}" is not a valid hostname component.`
      );
    }
  });

  it("caches accepted regions", () => {
    const di = {
      isValidHostLabel,
    };
    for (const region of acceptedRegionExamples) {
      expect(() => checkRegion(region, di.isValidHostLabel)).not.toThrow();
    }
    vi.spyOn(di, "isValidHostLabel").mockImplementation(isValidHostLabel);
    for (const region of acceptedRegionExamples) {
      expect(() => checkRegion(region, di.isValidHostLabel)).not.toThrow();
    }
    expect(di.isValidHostLabel).toHaveBeenCalledTimes(0);
    expect(() => checkRegion("oh-canada", di.isValidHostLabel)).not.toThrow();
    expect(di.isValidHostLabel).toHaveBeenCalledTimes(1);
  });
});
