import { Sha256 } from "@aws-crypto/sha256-js";
import { describe, expect, it, vi } from "vitest";

import { N_MINUS_TWO } from "./constants";
import { addOneToArray, buildFixedInputBuffer, getSigV4aSigningKey, isBiggerThanNMinus2 } from "./credentialDerivation";

describe("signatureV4a signing key", () => {
  it("should get signing key", async () => {
    const secret = "test-secret";
    const accessKey = "test-access-key";

    const mockSha256Constructor = vi.fn().mockImplementation((args) => {
      return new Sha256(args);
    });

    const result = await getSigV4aSigningKey(mockSha256Constructor, secret, accessKey);

    const expectedResult = new Uint8Array([
      107, 171, 179, 226, 62, 241, 77, 131, 240, 163, 149, 40, 120, 236, 169, 100, 28, 130, 40, 97, 214, 239, 24, 15,
      158, 224, 37, 30, 241, 83, 119, 174,
    ]);

    expect(result).toEqual(expectedResult);
  });

  it("buildFixedInputBuffer", () => {
    const startBuffer = "start";
    const accessKey = "key";
    const result = buildFixedInputBuffer(startBuffer, accessKey, 1);

    const expectedString =
      "start" +
      "\u0000\u0000\u0000\u0001" +
      "AWS4-ECDSA-P256-SHA256" +
      "\u0000" +
      "key" +
      "\u0001" +
      "\u0000\u0000\u0001\u0000";

    expect(result).toEqual(expectedString);
  });

  it("addOneToArray, no carry", () => {
    const originalValue = new Uint8Array(32);
    originalValue[31] = 0xfe;

    const result = addOneToArray(originalValue);

    expect(result.length).toEqual(32);
    expect(result[31]).toEqual(0xff);
    expect(result[30]).toEqual(0x00);
  });

  it("addOneToArray, carry", () => {
    const originalValue = new Uint8Array(32);
    originalValue[31] = 0xff;
    originalValue[30] = 0xff;
    originalValue[29] = 0xfe;

    const result = addOneToArray(originalValue);

    expect(result.length).toEqual(32);
    expect(result[31]).toEqual(0x00);
    expect(result[30]).toEqual(0x00);
    expect(result[29]).toEqual(0xff);
  });

  it("addOneToArray, carry to last digit", () => {
    const originalValue = new Uint8Array(32);
    for (let i = 0; i < originalValue.length; i++) {
      originalValue[i] = 0xff;
    }

    const result = addOneToArray(originalValue);

    expect(result.length).toEqual(33);

    expect(result[0]).toEqual(0x01);

    for (let i = 1; i < originalValue.length; i++) {
      expect(result[i]).toEqual(0x00);
    }
  });

  it("Number smaller than NMinus2", () => {
    let comparisonNumber = new Uint8Array(32);

    let result = isBiggerThanNMinus2(comparisonNumber);
    expect(result).toBeFalsy();

    comparisonNumber = new Uint8Array(N_MINUS_TWO);
    comparisonNumber[31] = comparisonNumber[31] - 1;

    result = isBiggerThanNMinus2(comparisonNumber);
    expect(result).toBeFalsy();
  });

  it("Number bigger than NMinus2", () => {
    let comparisonNumber = new Uint8Array(32);
    comparisonNumber[0] = 0xff;
    comparisonNumber[1] = 0xff;
    comparisonNumber[2] = 0xff;
    comparisonNumber[3] = 0xff;
    comparisonNumber[4] = 0x01;

    let result = isBiggerThanNMinus2(comparisonNumber);
    expect(result).toBeTruthy();

    comparisonNumber = new Uint8Array(N_MINUS_TWO);
    comparisonNumber[31] = comparisonNumber[31] + 1;

    result = isBiggerThanNMinus2(comparisonNumber);
    expect(result).toBeTruthy();
  });

  it("Number equals NMinus2", () => {
    const comparisonNumber = new Uint8Array(N_MINUS_TWO);

    const result = isBiggerThanNMinus2(comparisonNumber);

    expect(result).toBeFalsy();
  });
});
