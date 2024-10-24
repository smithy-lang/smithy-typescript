import {
  isClockSkewError,
  isRetryableByTrait,
  isThrottlingError,
  isTransientError,
} from "@smithy/service-error-classification";
import { SdkError } from "@smithy/types";
import { afterEach, beforeEach, describe, expect,test as it, vi } from "vitest";

import { defaultRetryDecider } from "./retryDecider";

vi.mock("@smithy/service-error-classification");

describe("defaultRetryDecider", () => {
  const createMockError = () => Object.assign(new Error(), { $metadata: {} }) as SdkError;

  beforeEach(() => {
    vi.mocked(isRetryableByTrait).mockReturnValue(false);
    vi.mocked(isClockSkewError).mockReturnValue(false);
    vi.mocked(isThrottlingError).mockReturnValue(false);
    vi.mocked(isTransientError).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when the provided error is falsy", () => {
    expect(defaultRetryDecider(null as any)).toBe(false);
    expect(vi.mocked(isRetryableByTrait)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(isClockSkewError)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(isTransientError)).toHaveBeenCalledTimes(0);
  });

  it("should return true for RetryableByTrait error", () => {
    vi.mocked(isRetryableByTrait).mockReturnValueOnce(true);
    expect(defaultRetryDecider(createMockError())).toBe(true);
    expect(vi.mocked(isRetryableByTrait)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isClockSkewError)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(isTransientError)).toHaveBeenCalledTimes(0);
  });

  it("should return true for ClockSkewError", () => {
    vi.mocked(isClockSkewError).mockReturnValueOnce(true);
    expect(defaultRetryDecider(createMockError())).toBe(true);
    expect(vi.mocked(isRetryableByTrait)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isClockSkewError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(isTransientError)).toHaveBeenCalledTimes(0);
  });

  it("should return true for ThrottlingError", () => {
    vi.mocked(isThrottlingError).mockReturnValueOnce(true);
    expect(defaultRetryDecider(createMockError())).toBe(true);
    expect(vi.mocked(isRetryableByTrait)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isClockSkewError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isTransientError)).toHaveBeenCalledTimes(0);
  });

  it("should return true for TransientError", () => {
    vi.mocked(isTransientError).mockReturnValueOnce(true);
    expect(defaultRetryDecider(createMockError())).toBe(true);
    expect(vi.mocked(isRetryableByTrait)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isClockSkewError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isTransientError)).toHaveBeenCalledTimes(1);
  });

  it("should return false for other errors", () => {
    expect(defaultRetryDecider(createMockError())).toBe(false);
    expect(vi.mocked(isRetryableByTrait)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isClockSkewError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isTransientError)).toHaveBeenCalledTimes(1);
  });
});
