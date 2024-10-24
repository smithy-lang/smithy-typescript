import { afterEach, beforeEach, describe, expect,test as it, vi } from "vitest";

import { getConfigData } from "./getConfigData";
import { getConfigFilepath } from "./getConfigFilepath";
import { getCredentialsFilepath } from "./getCredentialsFilepath";
import { getHomeDir } from "./getHomeDir";
import { loadSharedConfigFiles } from "./loadSharedConfigFiles";
import { parseIni } from "./parseIni";
import { slurpFile } from "./slurpFile";

vi.mock("./getConfigData");
vi.mock("./getConfigFilepath");
vi.mock("./getCredentialsFilepath");
vi.mock("./parseIni");
vi.mock("./slurpFile");
vi.mock("./getHomeDir");

describe("loadSharedConfigFiles", () => {
  const mockConfigFilepath = "/mock/file/path/config";
  const mockCredsFilepath = "/mock/file/path/credentials";
  const mockSharedConfigFiles = {
    configFile: mockConfigFilepath,
    credentialsFile: mockCredsFilepath,
  };
  const mockHomeDir = "/users/alias";

  beforeEach(() => {
    vi.mocked(getConfigFilepath).mockReturnValue(mockConfigFilepath);
    vi.mocked(getCredentialsFilepath).mockReturnValue(mockCredsFilepath);
    vi.mocked(parseIni).mockImplementation((args) => args);
    vi.mocked(getConfigData).mockImplementation((args) => args);
    vi.mocked(slurpFile).mockImplementation((path) => Promise.resolve(path));
    vi.mocked(getHomeDir).mockReturnValue(mockHomeDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns configFile and credentialsFile from default locations", async () => {
    const sharedConfigFiles = await loadSharedConfigFiles();
    expect(sharedConfigFiles).toStrictEqual(mockSharedConfigFiles);
    expect(getConfigFilepath).toHaveBeenCalledWith();
    expect(getCredentialsFilepath).toHaveBeenCalledWith();
  });

  it("returns configFile and credentialsFile from init if defined", async () => {
    const sharedConfigFiles = await loadSharedConfigFiles({
      filepath: mockCredsFilepath,
      configFilepath: mockConfigFilepath,
    });
    expect(sharedConfigFiles).toStrictEqual(mockSharedConfigFiles);
    expect(getConfigFilepath).not.toHaveBeenCalled();
    expect(getCredentialsFilepath).not.toHaveBeenCalled();
  });

  it("expands homedir in configFile and credentialsFile from init if defined", async () => {
    const sharedConfigFiles = await loadSharedConfigFiles({
      filepath: "~/path/credentials",
      configFilepath: "~/path/config",
    });
    expect(sharedConfigFiles).toStrictEqual({
      configFile: "/users/alias/path/config",
      credentialsFile: "/users/alias/path/credentials",
    });
    expect(getHomeDir).toHaveBeenCalled();
    expect(getConfigFilepath).not.toHaveBeenCalled();
    expect(getCredentialsFilepath).not.toHaveBeenCalled();
  });

  describe("swallows error and returns empty configuration", () => {
    it("when readFile throws error", async () => {
      vi.mocked(slurpFile).mockRejectedValue("error");
      const sharedConfigFiles = await loadSharedConfigFiles();
      expect(sharedConfigFiles).toStrictEqual({ configFile: {}, credentialsFile: {} });
    });

    it("when parseIni throws error", async () => {
      vi.mocked(parseIni).mockRejectedValue("error");
      const sharedConfigFiles = await loadSharedConfigFiles();
      expect(sharedConfigFiles).toStrictEqual({ configFile: {}, credentialsFile: {} });
    });

    it("when normalizeConfigFile throws error", async () => {
      vi.mocked(getConfigData).mockRejectedValue("error");
      const sharedConfigFiles = await loadSharedConfigFiles();
      expect(sharedConfigFiles).toStrictEqual({
        configFile: {},
        credentialsFile: mockCredsFilepath,
      });
    });
  });
});
