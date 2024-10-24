import { describe, expect,test as it, vi } from "vitest";

import { CredentialsProviderError } from "./CredentialsProviderError";
import { ProviderError } from "./ProviderError";

describe(CredentialsProviderError.name, () => {
  it("should be named CredentialsProviderError", () => {
    expect(new CredentialsProviderError("PANIC").name).toBe("CredentialsProviderError");
  });

  it("should have a non-enumerable message like the base Error class", () => {
    expect(new CredentialsProviderError("PANIC", {}).message).toBe("PANIC");

    expect(
      {
        ...new CredentialsProviderError("PANIC", {}),
      }.message
    ).toBe(undefined);
  });

  it("should have an enumerable tryNextLink and logger like the base Error class", () => {
    expect(new CredentialsProviderError("PANIC", {}).tryNextLink).toBe(true);

    expect(
      {
        ...new CredentialsProviderError("PANIC", { tryNextLink: false }),
      }.tryNextLink
    ).toBe(false);
  });

  it("should use logger.debug if provided", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
    new CredentialsProviderError("PANIC", { logger });

    expect(logger.debug).toHaveBeenCalled();
    expect(logger.trace).not.toHaveBeenCalled();
  });

  describe.each([Error, ProviderError, CredentialsProviderError])("should be instanceof %p", (classConstructor) => {
    it("when created using constructor", () => {
      expect(new CredentialsProviderError("PANIC")).toBeInstanceOf(classConstructor);
    });

    it("when created using from()", () => {
      expect(CredentialsProviderError.from(new Error("PANIC"))).toBeInstanceOf(classConstructor);
    });
  });
});
