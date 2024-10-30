import { join } from "path";
import { afterEach, describe, expect, test as it, vi } from "vitest";

import { ENV_CONFIG_PATH, getConfigFilepath } from "./getConfigFilepath";
import { getHomeDir } from "./getHomeDir";

vi.mock("path");
vi.mock("./getHomeDir");

describe(getConfigFilepath.name, () => {
  const mockSeparator = "/";
  const mockHomeDir = "/mock/home/dir";

  const mockConfigFilepath = "/mock/file/path/config";
  const defaultConfigFilepath = `${mockHomeDir}/.aws/config`;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns configFilePath from default locations", () => {
    vi.mocked(join).mockImplementation((...args) => args.join(mockSeparator));
    vi.mocked(getHomeDir).mockReturnValue(mockHomeDir);
    expect(getConfigFilepath()).toStrictEqual(defaultConfigFilepath);
    expect(getHomeDir).toHaveBeenCalledWith();
    expect(join).toHaveBeenCalledWith(mockHomeDir, ".aws", "config");
  });

  it("returns configFile from location defined in environment", () => {
    const OLD_ENV = process.env;
    process.env = {
      ...OLD_ENV,
      [ENV_CONFIG_PATH]: mockConfigFilepath,
    };
    expect(getConfigFilepath()).toStrictEqual(mockConfigFilepath);
    expect(getHomeDir).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
    process.env = OLD_ENV;
  });
});
