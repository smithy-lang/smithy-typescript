import { CredentialsProviderError } from "./CredentialsProviderError";
import { ProviderError } from "./ProviderError";

describe(CredentialsProviderError.name, () => {
  afterAll(() => {
    CredentialsProviderError.logLimit = 100;
  });

  it("should be named as CredentialsProviderError", () => {
    expect(new CredentialsProviderError("PANIC").name).toBe("CredentialsProviderError");
  });

  it("should log up to its logLimit", () => {
    CredentialsProviderError.logLimit = 5;

    Array.from({ length: CredentialsProviderError.logLimit + 2 }).forEach(() => {
      new CredentialsProviderError("PANIC");
    });

    expect(CredentialsProviderError.log.length).toEqual(CredentialsProviderError.logLimit);
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
