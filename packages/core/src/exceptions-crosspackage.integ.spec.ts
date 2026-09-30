import { ServiceException } from "@smithy/core/client";
import { describe, expect, test as it } from "vitest";
import {
  HaltError as HaltError1,
  MainServiceLinkedError as MainServiceLinkedError1,
  XYZServiceSyntheticServiceException as SynthBase1,
} from "xyz";
import {
  HaltError as HaltError2,
  MainServiceLinkedError as MainServiceLinkedError2,
  XYZServiceSyntheticServiceException as SynthBase2,
} from "xyz-schema";

describe("cross-package exception instanceof (aws-sdk-js-v3#8323)", () => {
  const haltError1 = new HaltError1({ $metadata: {}, message: "" });
  const haltError2 = new HaltError2({ $metadata: {}, message: "" });

  it("distinct class objects across the two copies", () => {
    expect(HaltError1).not.toBe(HaltError2);
    expect(SynthBase1).not.toBe(SynthBase2);
  });

  it("a modeled error is instanceof its own and the other copy's modeled + synthetic base", () => {
    for (const err of [haltError1, haltError2]) {
      expect(err).toBeInstanceOf(HaltError1);
      expect(err).toBeInstanceOf(HaltError2);
      expect(err).toBeInstanceOf(SynthBase1);
      expect(err).toBeInstanceOf(SynthBase2);
    }
  });

  it("synthetic bases are instanceof each other", () => {
    const base1 = new SynthBase1({ name: "e", $fault: "client", $metadata: {} });
    const base2 = new SynthBase2({ name: "e", $fault: "client", $metadata: {} });
    expect(base1).toBeInstanceOf(SynthBase2);
    expect(base2).toBeInstanceOf(SynthBase1);
  });

  it("all are instanceof ServiceException and Error", () => {
    for (const e of [haltError1, haltError2, new SynthBase1({ name: "e", $fault: "client", $metadata: {} })]) {
      expect(e).toBeInstanceOf(ServiceException);
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("an error is not an instanceof an unrelated sibling error (same or other copy)", () => {
    // The #8323 bug: minified constructor names collapsed and made these match.
    for (const err of [haltError1, haltError2]) {
      expect(err).not.toBeInstanceOf(MainServiceLinkedError1);
      expect(err).not.toBeInstanceOf(MainServiceLinkedError2);
    }
  });

  it("a synthetic base instance is not an instanceof a leaf error", () => {
    for (const base of [
      new SynthBase1({ name: "e", $fault: "client", $metadata: {} }),
      new SynthBase2({ name: "e", $fault: "client", $metadata: {} }),
    ]) {
      expect(base).not.toBeInstanceOf(HaltError1);
      expect(base).not.toBeInstanceOf(HaltError2);
    }
  });

  it("a plain Error is not an instanceof any modeled or base exception", () => {
    const plain = new Error("x");
    expect(plain).not.toBeInstanceOf(HaltError1);
    expect(plain).not.toBeInstanceOf(SynthBase1);
    expect(plain).not.toBeInstanceOf(ServiceException);
  });
});
