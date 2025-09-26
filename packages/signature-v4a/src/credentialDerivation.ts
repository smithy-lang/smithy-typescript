import { ALGORITHM_IDENTIFIER_V4A, KEY_TYPE_IDENTIFIER } from "@smithy/signature-v4";
import type { ChecksumConstructor, HashConstructor } from "@smithy/types";
import { toUint8Array } from "@smithy/util-utf8";

import { N_MINUS_TWO, ONE_AS_4_BYTES, TWOFIFTYSIX_AS_4_BYTES } from "./constants";

const signingKeyCache: Record<string, Uint8Array> = {};
const cacheQueue: Array<string> = [];

/**
 * Create a string describing the scope of credentials used to sign a request. * @param shortDate
 * @param shortDate The current calendar date in the form YYYYMMDD.
 * @param service   The service to which the signed request is being sent.
 */
export const createSigV4aScope = (shortDate: string, service: string): string =>
  `${shortDate}/${service}/${KEY_TYPE_IDENTIFIER}`;

/**
 * @internal
 */
export const clearCredentialCache = (): void => {
  cacheQueue.length = 0;
  Object.keys(signingKeyCache).forEach((cacheKey) => {
    delete signingKeyCache[cacheKey];
  });
};

/**
 * @internal
 */
export const getSigV4aSigningKey = async (
  sha256: ChecksumConstructor | HashConstructor,
  accessKey: string,
  secretKey: string
): Promise<Uint8Array> => {
  let outputBufferWriter = "";
  /*
   * The maximum number of iterations we will attempt to derive a valid ecc key for.  The probability that this counter
   * value ever gets reached is vanishingly low -- with reasonable uniformity/independence assumptions, it's
   * approximately
   *
   *  2 ^ (-32 * 254)
   */
  const maxTrials = 254;
  const aws4ALength = 5;
  const inputKeyLength = aws4ALength + secretKey.length;

  // Allocate array
  const inputKeyBuf = inputKeyLength <= 64 ? new Uint8Array(64) : new Uint8Array(inputKeyLength);

  // Input AWS4A and secret into array
  const aws4aArray = "AWS4A".split("");

  for (let index = 0; index < aws4aArray.length; index++) {
    inputKeyBuf[index] = aws4aArray[index].charCodeAt(0);
  }

  const secretKeyArray = secretKey.split("");

  for (let index = 0; index < secretKeyArray.length; index++) {
    inputKeyBuf[aws4aArray.length + index] = secretKeyArray[index].charCodeAt(0);
  }

  let trial = 1;
  while (trial < maxTrials) {
    outputBufferWriter = buildFixedInputBuffer(outputBufferWriter, accessKey, trial);

    const secretKey = inputKeyBuf.subarray(0, inputKeyLength);
    const hash = new sha256(secretKey);

    const hashVal = toUint8Array(outputBufferWriter);
    hash.update(hashVal);

    const hashedOutput = await hash.digest();

    if (isBiggerThanNMinus2(hashedOutput)) {
      trial++;
      continue;
    }

    return addOneToArray(hashedOutput);
  }

  throw new Error("Cannot derive signing key: number of maximum trials exceeded.");
};

/**
 * Build the signing key request. Implementation copied from .NET implementation
 * @param bufferInput Input string. Will append values and return as new string
 * @param accessKey Access key used for signing
 * @param counter Trial number
 */
export const buildFixedInputBuffer = (bufferInput: string, accessKey: string, counter: number): string => {
  /*
  Label = “AWS4-ECDSA-P256-SHA256”
  ExternalCounter = 0x01
  This counter would be incremented by 1 if the step below fails.
  Context = "AccessKeyID" || ExternalCounter
  Length = “256”, 0x0100 (32-bit integer)
  FixedInputString= 1 || Label || 0x00 || Context || Length
   */

  let outputBuffer = bufferInput;

  outputBuffer += ONE_AS_4_BYTES.map((value) => String.fromCharCode(value)).join("");

  outputBuffer += ALGORITHM_IDENTIFIER_V4A;

  outputBuffer += String.fromCharCode(0x00);

  outputBuffer += accessKey;

  outputBuffer += String.fromCharCode(counter);

  outputBuffer += TWOFIFTYSIX_AS_4_BYTES.map((value) => String.fromCharCode(value)).join("");

  return outputBuffer;
};

/**
 * Check if calculated value is larger than NMinus2 constant
 * @param value Array in Big-Endian format
 */
export const isBiggerThanNMinus2 = (value: Uint8Array): boolean => {
  // N_MINUS_TWO constant is 32 in length, hashed input is also 32 in length
  // It is in Big-Endian format, significant digit first.

  for (let index = 0; index < value.length; index++) {
    if (value[index] > N_MINUS_TWO[index]) {
      // Value is greater than const
      return true;
    } else if (value[index] < N_MINUS_TWO[index]) {
      // Const is greater
      return false;
    }
  }

  // Numbers are then same
  return false;
};

/**
 * Adds one to a big-endian number
 * @param value Big-endian formatted number
 */
export const addOneToArray = (value: Uint8Array): Uint8Array => {
  // Value is in Big-Endian format, significant digit first. This is why we go the opposite way when calculating
  const output = new Uint8Array(32);

  // We are adding one, we can simply add this to carry
  let carry = 1;

  for (let index = value.length - 1; index >= 0; index--) {
    const newValueAtIndex = (value[index] + carry) % 256;

    // If the new value is less than the old, we must have eclipsed 255. We need to carry a digit
    if (newValueAtIndex < value[index]) {
      carry = 1;
    } else {
      carry = 0;
    }

    output[index] = newValueAtIndex;
  }

  if (carry !== 0) {
    return new Uint8Array([carry, ...output]);
  }

  return output;
};
