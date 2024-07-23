import { DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT, providerConfigFromInit } from "./RemoteProviderInit";

describe("providerConfigFromInit", () => {
  it("should populate default values for retries and timeouts", () => {
    expect(providerConfigFromInit({})).toEqual({
      timeout: DEFAULT_TIMEOUT,
      maxRetries: DEFAULT_MAX_RETRIES,
    });
  });

  it("should pass through timeout and retries overrides", () => {
    const timeout = 123456789;
    const maxRetries = 987654321;

    expect(providerConfigFromInit({ timeout, maxRetries })).toEqual({
      timeout,
      maxRetries,
    });
  });

  it("should return maxAttempts with the same value as the deprecated maxRetries if maxAttempts is NOT provided", () => {
    const timeout = 123456789;
    const maxRetries = 987654321;

    expect(providerConfigFromInit({ timeout, maxRetries })).toEqual({
      timeout,
      maxRetries,
      maxAttempts: maxRetries,
    });
  });

  it("should return maxAttempts with the same value as maxAttempts option if it is provided", () => {
    const timeout = 123456789;
    const maxRetries = 987654321;
    const maxAttempts = 987654322;

    expect(providerConfigFromInit({ timeout, maxRetries, maxAttempts })).toEqual({
      timeout,
      maxRetries,
      maxAttempts,
    });
  });

  it("should return maxAttempts with DEFAULT_MAX_RETRIES as value if both maxAttempts and maxRetries are NOT provided", () => {
    const timeout = 123456789;

    expect(providerConfigFromInit({ timeout })).toEqual({
      timeout,
      maxRetries: 0,
      maxAttempts: 0,
    });
  });

  it("should return maxRetries with the same value as the new maxRetries maxAttempts if maxAttempts is provided with any value", () => {
    const timeout = 123456789;
    const maxAttempts = 987654321;

    expect(providerConfigFromInit({ timeout, maxAttempts })).toEqual({
      timeout,
      maxRetries: maxAttempts,
      maxAttempts,
    });
  });
});
