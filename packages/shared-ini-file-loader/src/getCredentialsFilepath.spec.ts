import { join } from "path";
import { afterEach, describe, expect,test as it, vi } from "vitest";

import { ENV_CREDENTIALS_PATH, getCredentialsFilepath } from "./getCredentialsFilepath";
import { getHomeDir } from "./getHomeDir";

vi.mock("path");
vi.mock("./getHomeDir");

describe(getCredentialsFilepath.name, () => {
  const mockSeparator = "/";
  const mockHomeDir = "/mock/home/dir";

  const mockConfigFilepath = "/mock/file/path/credentials";
  const defaultConfigFilepath = `${mockHomeDir}/.aws/credentials`;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns configFilePath from default locations", () => {
    vi.mocked(join).mockImplementation((...args) => args.join(mockSeparator));
    vi.mocked(getHomeDir).mockReturnValue(mockHomeDir);
    expect(getCredentialsFilepath()).toStrictEqual(defaultConfigFilepath);
    expect(getHomeDir).toHaveBeenCalledWith();
    expect(join).toHaveBeenCalledWith(mockHomeDir, ".aws", "credentials");
  });

  it("returns configFile from location defined in environment", () => {
    const OLD_ENV = process.env;
    process.env = {
      ...OLD_ENV,
      [ENV_CREDENTIALS_PATH]: mockConfigFilepath,
    };
    expect(getCredentialsFilepath()).toStrictEqual(mockConfigFilepath);
    expect(getHomeDir).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
    process.env = OLD_ENV;
  });
});
