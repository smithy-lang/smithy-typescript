import type { Provider } from "@smithy/types";
import { normalizeProvider } from "@smithy/util-middleware";
import { AdaptiveRetryStrategy, DEFAULT_MAX_ATTEMPTS, StandardRetryStrategy } from "@smithy/util-retry";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import {
  CONFIG_MAX_ATTEMPTS,
  ENV_MAX_ATTEMPTS,
  NODE_MAX_ATTEMPT_CONFIG_OPTIONS,
  resolveRetryConfig,
} from "./configurations";

vi.mock("@smithy/util-middleware");
vi.mock("@smithy/util-retry");

describe(resolveRetryConfig.name, () => {
  const retryMode = vi.fn() as any;

  beforeEach(() => {
    vi.mocked(normalizeProvider).mockImplementation((input) =>
      typeof input === "function" ? (input as Provider<unknown>) : () => Promise.resolve(input)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maintains object custody", () => {
    const input = {
      retryMode: "STANDARD",
    };
    expect(resolveRetryConfig(input)).toBe(input);
  });

  describe("maxAttempts", () => {
    it.each([1, 2, 3])("assigns provided value %s", async (maxAttempts) => {
      const output = await resolveRetryConfig({ maxAttempts, retryMode }).maxAttempts();
      expect(output).toStrictEqual(maxAttempts);
    });

    it(`assigns default ${DEFAULT_MAX_ATTEMPTS} is value not provided`, async () => {
      const output = await resolveRetryConfig({ retryMode }).maxAttempts();
      expect(output).toStrictEqual(DEFAULT_MAX_ATTEMPTS);
    });
  });

  describe("retryStrategy", () => {
    it("passes retryStrategy if present", async () => {
      const mockRetryStrategy = {
        retry: vi.fn(),
      };
      const { retryStrategy } = resolveRetryConfig({
        retryMode,
        retryStrategy: mockRetryStrategy,
      });
      expect(await retryStrategy()).toEqual(mockRetryStrategy);
    });

    describe("creates RetryStrategy if retryStrategy not present", () => {
      describe("StandardRetryStrategy", () => {
        describe("when retryMode=standard", () => {
          describe("passes maxAttempts if present", () => {
            const retryMode = "standard";
            for (const maxAttempts of [1, 2, 3]) {
              it(`when maxAttempts=${maxAttempts}`, async () => {
                const { retryStrategy } = resolveRetryConfig({ maxAttempts, retryMode });
                await retryStrategy();
                expect(vi.mocked(StandardRetryStrategy)).toHaveBeenCalledTimes(1);
                expect(vi.mocked(AdaptiveRetryStrategy)).not.toHaveBeenCalled();
                const output = await vi.mocked(StandardRetryStrategy).mock.calls[0][0]();
                expect(output).toStrictEqual(maxAttempts);
              });
            }
          });
        });

        describe("when retryMode returns 'standard'", () => {
          describe("passes maxAttempts if present", () => {
            beforeEach(() => {
              retryMode.mockResolvedValueOnce("standard");
            });
            for (const maxAttempts of [1, 2, 3]) {
              it(`when maxAttempts=${maxAttempts}`, async () => {
                const { retryStrategy } = resolveRetryConfig({ maxAttempts, retryMode });
                await retryStrategy();
                expect(retryMode).toHaveBeenCalledTimes(1);
                expect(vi.mocked(StandardRetryStrategy)).toHaveBeenCalledTimes(1);
                expect(vi.mocked(AdaptiveRetryStrategy)).not.toHaveBeenCalled();
                const output = await vi.mocked(StandardRetryStrategy).mock.calls[0][0]();
                expect(output).toStrictEqual(maxAttempts);
              });
            }
          });
        });
      });

      describe("AdaptiveRetryStrategy", () => {
        describe("when retryMode=adaptive", () => {
          describe("passes maxAttempts if present", () => {
            const retryMode = "adaptive";
            for (const maxAttempts of [1, 2, 3]) {
              it(`when maxAttempts=${maxAttempts}`, async () => {
                const { retryStrategy } = resolveRetryConfig({ maxAttempts, retryMode });
                await retryStrategy();
                expect(vi.mocked(StandardRetryStrategy)).not.toHaveBeenCalled();
                expect(vi.mocked(AdaptiveRetryStrategy)).toHaveBeenCalledTimes(1);
                const output = await vi.mocked(AdaptiveRetryStrategy).mock.calls[0][0]();
                expect(output).toStrictEqual(maxAttempts);
              });
            }
          });
        });

        describe("when retryMode returns 'adaptive'", () => {
          describe("passes maxAttempts if present", () => {
            beforeEach(() => {
              retryMode.mockResolvedValueOnce("adaptive");
            });
            for (const maxAttempts of [1, 2, 3]) {
              it(`when maxAttempts=${maxAttempts}`, async () => {
                const { retryStrategy } = resolveRetryConfig({ maxAttempts, retryMode });
                await retryStrategy();
                expect(retryMode).toHaveBeenCalledTimes(1);
                expect(vi.mocked(StandardRetryStrategy)).not.toHaveBeenCalled();
                expect(vi.mocked(AdaptiveRetryStrategy)).toHaveBeenCalledTimes(1);
                const output = await vi.mocked(AdaptiveRetryStrategy).mock.calls[0][0]();
                expect(output).toStrictEqual(maxAttempts);
              });
            }
          });
        });
      });
    });
  });

  describe("node maxAttempts config options", () => {
    describe("environmentVariableSelector", () => {
      it(`should return value of env ${ENV_MAX_ATTEMPTS} is number`, () => {
        const value = "3";
        const env = { [ENV_MAX_ATTEMPTS]: value };
        expect(NODE_MAX_ATTEMPT_CONFIG_OPTIONS.environmentVariableSelector(env)).toBe(parseInt(value));
      });

      it(`should return undefined if env ${ENV_MAX_ATTEMPTS} is not set`, () => {
        expect(NODE_MAX_ATTEMPT_CONFIG_OPTIONS.environmentVariableSelector({})).toBe(undefined);
      });

      it(`should throw if if value of env ${ENV_MAX_ATTEMPTS} is not a number`, () => {
        const value = "not a number";
        const env = { [ENV_MAX_ATTEMPTS]: value };
        expect(() => NODE_MAX_ATTEMPT_CONFIG_OPTIONS.environmentVariableSelector(env)).toThrow();
      });
    });

    describe("configFileSelector", () => {
      it(`should return value of shared INI files entry ${CONFIG_MAX_ATTEMPTS} is number`, () => {
        const value = "3";
        const profile = { [CONFIG_MAX_ATTEMPTS]: value };
        expect(NODE_MAX_ATTEMPT_CONFIG_OPTIONS.configFileSelector(profile)).toBe(parseInt(value));
      });

      it(`should return undefined if shared INI files entry ${CONFIG_MAX_ATTEMPTS} is not set`, () => {
        expect(NODE_MAX_ATTEMPT_CONFIG_OPTIONS.configFileSelector({})).toBe(undefined);
      });

      it(`should throw if shared INI files entry ${CONFIG_MAX_ATTEMPTS} is not a number`, () => {
        const value = "not a number";
        const profile = { [CONFIG_MAX_ATTEMPTS]: value };
        expect(() => NODE_MAX_ATTEMPT_CONFIG_OPTIONS.configFileSelector(profile)).toThrow();
      });
    });

    describe("default", () => {
      it(`should equal to ${DEFAULT_MAX_ATTEMPTS}`, () => {
        expect(NODE_MAX_ATTEMPT_CONFIG_OPTIONS.default).toBe(DEFAULT_MAX_ATTEMPTS);
      });
    });
  });
});
