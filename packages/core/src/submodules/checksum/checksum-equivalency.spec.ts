import { randomBytes } from "node:crypto";
import { AwsCrc32 } from "@aws-crypto/crc32";
import { Sha256 as AwsSha256 } from "@aws-crypto/sha256-js";
import { describe, expect, it } from "vitest";

import { Crc32Js } from "./crc32/Crc32Js";
import { Crc32Node } from "./crc32/Crc32Node";
import { Sha256Js } from "./sha256/Sha256Js";
import { Sha256Node } from "./sha256/Sha256Node";
import { Sha256WebCrypto } from "./sha256/Sha256WebCrypto";

const LIMIT = 100 * 1024 * 1024;

function* chunkSequence(): Generator<Uint8Array> {
  let total = 0;
  // 0, then 10x 1-byte, then doubling: 2,3,5,9,17,33,65,...
  const sizes = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  let s = 2;
  while (s < LIMIT) {
    sizes.push(s);
    s = s * 2 - 1;
  }
  for (const size of sizes) {
    if (total + size > LIMIT) {
      break;
    }
    yield randomBytes(size);
    total += size;
  }
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

type Factory = () => { update(data: Uint8Array): void; digest(): Promise<Uint8Array> };

async function assertStrictIncrementalEquivalence(label: string, impls: { name: string; create: Factory }[]) {
  const instances = impls.map(({ name, create }) => ({ name, hash: create() }));

  for (const chunk of chunkSequence()) {
    for (const { hash } of instances) {
      hash.update(chunk);
    }

    const digests: Record<string, string> = {};
    for (const { name, hash } of instances) {
      digests[name] = toHex(await hash.digest());
    }

    const values = Object.values(digests);
    const allEqual = values.every((v) => v === values[0]);
    expect(allEqual, `${label} mismatch: ${JSON.stringify(digests)}`).toBe(true);
  }
}

async function assertFinalizedEquivalence(label: string, impls: { name: string; create: Factory }[]) {
  const instances = impls.map(({ name, create }) => ({ name, hash: create() }));

  for (const chunk of chunkSequence()) {
    for (const { hash } of instances) {
      hash.update(chunk);
    }
  }

  const digests: Record<string, string> = {};
  for (const { name, hash } of instances) {
    digests[name] = toHex(await hash.digest());
  }

  const values = Object.values(digests);
  const allEqual = values.every((v) => v === values[0]);
  expect(allEqual, `${label} mismatch: ${JSON.stringify(digests)}`).toBe(true);
}

describe("CRC-32 equivalency", () => {
  it(
    "all implementations produce identical digests at every chunk boundary",
    () =>
      assertStrictIncrementalEquivalence("CRC-32", [
        { name: "Crc32Js", create: () => new Crc32Js() },
        { name: "Crc32Node", create: () => new Crc32Node() },
        { name: "@aws-crypto/crc32", create: () => new AwsCrc32() },
      ]),
    30_000
  );
});

describe("SHA-256 hash equivalency", () => {
  it(
    "all implementations produce identical digests at every chunk boundary",
    () =>
      assertStrictIncrementalEquivalence("SHA-256 hash", [
        { name: "Sha256Js", create: () => new Sha256Js() },
        { name: "Sha256Node", create: () => new Sha256Node() },
        { name: "Sha256WebCrypto", create: () => new Sha256WebCrypto() },
      ]),
    30_000
  );

  it(
    "final digest matches @aws-crypto/sha256-js reference",
    () =>
      assertFinalizedEquivalence("SHA-256 hash vs reference", [
        { name: "Sha256Js", create: () => new Sha256Js() },
        { name: "@aws-crypto/sha256-js", create: () => new AwsSha256() },
      ]),
    30_000
  );
});

describe("SHA-256 HMAC equivalency", () => {
  const secret = Array.from(randomBytes(32)).join("");
  it(
    "all implementations produce identical HMAC digests",
    () =>
      assertFinalizedEquivalence("SHA-256 HMAC", [
        { name: "Sha256Js", create: () => new Sha256Js(secret) },
        { name: "Sha256Node", create: () => new Sha256Node(secret) },
        { name: "Sha256WebCrypto", create: () => new Sha256WebCrypto(secret) },
        { name: "@aws-crypto/sha256-js", create: () => new AwsSha256(secret) },
      ]),
    30_000
  );
});
