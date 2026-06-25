/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { InternalFailureException, SerializationException, isFrameworkException } from "./errors";

describe("isFrameworkException", () => {
  it("returns true for a framework exception", () => {
    expect(isFrameworkException(new InternalFailureException())).toBe(true);
    expect(isFrameworkException(new SerializationException())).toBe(true);
  });

  it("returns false for a non-framework object", () => {
    expect(isFrameworkException(new Error("boom"))).toBe(false);
    expect(isFrameworkException({})).toBe(false);
    expect(isFrameworkException({ $frameworkError: false })).toBe(false);
  });

  it("returns false (does not throw) for thrown primitives and nullish values", () => {
    expect(() => isFrameworkException(null)).not.toThrow();
    expect(() => isFrameworkException(undefined)).not.toThrow();
    expect(isFrameworkException(null)).toBe(false);
    expect(isFrameworkException(undefined)).toBe(false);
    expect(isFrameworkException("a string")).toBe(false);
    expect(isFrameworkException(42)).toBe(false);
    expect(isFrameworkException(true)).toBe(false);
    expect(isFrameworkException(Symbol("s"))).toBe(false);
  });
});
