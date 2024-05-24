import { CredentialsProviderError } from "./CredentialsProviderError";
import { ProviderError } from "./ProviderError";

describe(CredentialsProviderError.name, () => {
  it("should be named as CredentialsProviderError", () => {
    expect(new CredentialsProviderError("PANIC").name).toBe("CredentialsProviderError");
  });

  it("should use logger.trace if provided", () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    };
    new CredentialsProviderError("PANIC", { logger });

    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalled();
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
