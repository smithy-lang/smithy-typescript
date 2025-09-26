import { CredentialsProviderError } from "@smithy/property-provider";
import { afterAll, afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { fromEnv } from "./fromEnv";

describe("fromEnv", () => {
  describe("with env var getter", () => {
    const ENV_VAR_NAME = "ENV_VAR_NAME";

    const envVarGetter = vi.fn();
    const envVarValue = process.env[ENV_VAR_NAME];
    const mockEnvVarValue = "mockEnvVarValue";

    beforeEach(() => {
      envVarGetter.mockImplementation((env: Record<string, string>) => {
        if (env[ENV_VAR_NAME]) return env[ENV_VAR_NAME];
        throw new CredentialsProviderError(`Not found in ENV: ${ENV_VAR_NAME}`);
      });
      delete process.env[ENV_VAR_NAME];
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    afterAll(() => {
      process.env[ENV_VAR_NAME] = envVarValue;
    });

    describe("CredentialsProviderError", () => {
      it("is behaving as expected cross-package in vitest", () => {
        expect(new CredentialsProviderError("msg", {}).message).toEqual("msg");
        expect(new CredentialsProviderError("msg", {}).name).toEqual("CredentialsProviderError");
      });
    });

    it(`returns string value in '${ENV_VAR_NAME}' env var when set`, async () => {
      process.env[ENV_VAR_NAME] = mockEnvVarValue;
      await expect(fromEnv(envVarGetter)()).resolves.toBe(mockEnvVarValue);
      expect(envVarGetter).toHaveBeenCalledWith(process.env, undefined);
    });

    it(`passes options to envVarSelector if it's set`, async () => {
      process.env[ENV_VAR_NAME] = mockEnvVarValue;
      const options = { signingName: "signingName" };
      await expect(fromEnv(envVarGetter, options)()).resolves.toBe(mockEnvVarValue);
      expect(envVarGetter).toHaveBeenCalledWith(process.env, options);
    });

    it("return complex value from the getter", () => {
      type Value = { Foo: string };
      const value: Value = { Foo: "bar" };
      const getter: (env: any) => Value = vi.fn().mockReturnValue(value);
      // Validate the generic type works
      return expect(fromEnv(getter)()).resolves.toEqual(value);
    });

    it(`throws when '${ENV_VAR_NAME}' env var is not set`, async () => {
      expect.assertions(1);
      const error = await fromEnv(envVarGetter)().catch((_) => _);
      return expect(error).toEqual(new CredentialsProviderError(`Not found in ENV: ENV_VAR_NAME`, {}));
    });

    it("throws when the getter function throws", () => {
      const exception = new Error("Exception when getting the config");
      const getter: (env: any) => any = vi.fn().mockRejectedValue(exception);
      return expect(fromEnv(getter)()).rejects.toEqual(exception);
    });
  });
});
