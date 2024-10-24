import { chain, fromStatic, memoize } from "@smithy/property-provider";
import { Profile } from "@smithy/types";
import { afterEach, describe, expect,test as it, vi } from "vitest";

import { loadConfig } from "./configLoader";
import { fromEnv } from "./fromEnv";
import { fromSharedConfigFiles, SharedConfigInit } from "./fromSharedConfigFiles";

vi.mock("./fromEnv");
vi.mock("./fromSharedConfigFiles");
vi.mock("@smithy/property-provider");

describe("loadConfig", () => {
  const configuration: SharedConfigInit = {
    profile: "profile",
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes fromEnv(), fromSharedConfigFiles() and fromStatic() to chain", () => {
    const mockFromEnvReturn = "mockFromEnvReturn";
    vi.mocked(fromEnv).mockReturnValueOnce(mockFromEnvReturn);
    const mockFromSharedConfigFilesReturn = "mockFromSharedConfigFilesReturn";
    vi.mocked(fromSharedConfigFiles).mockReturnValueOnce(mockFromSharedConfigFilesReturn);
    const mockFromStatic = "mockFromStatic";
    vi.mocked(fromStatic).mockReturnValueOnce(mockFromStatic);
    // Using Record<string, string | undefined> instead of NodeJS.ProcessEnv, in order to not get type errors in non node environments
    const envVarSelector = (env: Record<string, string | undefined>) => env["AWS_CONFIG_FOO"];
    const configKey = (profile: Profile) => profile["aws_config_foo"];
    const defaultValue = "foo-value";
    loadConfig(
      {
        environmentVariableSelector: envVarSelector,
        configFileSelector: configKey,
        default: defaultValue,
      },
      configuration
    );
    expect(fromEnv).toHaveBeenCalledTimes(1);
    expect(fromEnv).toHaveBeenCalledWith(envVarSelector);
    expect(fromSharedConfigFiles).toHaveBeenCalledTimes(1);
    expect(fromSharedConfigFiles).toHaveBeenCalledWith(configKey, configuration);
    expect(fromStatic).toHaveBeenCalledTimes(1);
    expect(fromStatic).toHaveBeenCalledWith(defaultValue);
    expect(chain).toHaveBeenCalledTimes(1);
    expect(chain).toHaveBeenCalledWith(mockFromEnvReturn, mockFromSharedConfigFilesReturn, mockFromStatic);
  });

  it("passes output of chain to memoize", () => {
    const mockChainReturn = "mockChainReturn";
    vi.mocked(chain).mockReturnValueOnce(mockChainReturn);
    loadConfig({} as any);
    expect(chain).toHaveBeenCalledTimes(1);
    expect(memoize).toHaveBeenCalledTimes(1);
    expect(memoize).toHaveBeenCalledWith(mockChainReturn);
  });

  it("returns output memoize", () => {
    const mockMemoizeReturn = "mockMemoizeReturn";
    vi.mocked(memoize).mockReturnValueOnce(mockMemoizeReturn);
    expect(loadConfig({} as any)).toEqual(mockMemoizeReturn);
  });
});
