import { getConfigData } from "./getConfigData";
import { getConfigFilepath } from "./getConfigFilepath";
import { getCredentialsFilepath } from "./getCredentialsFilepath";
import { getHomeDir } from "./getHomeDir";
import { loadSharedConfigFiles } from "./loadSharedConfigFiles";
import { parseIni } from "./parseIni";
import { slurpFile } from "./slurpFile";

jest.mock("./getConfigData");
jest.mock("./getConfigFilepath");
jest.mock("./getCredentialsFilepath");
jest.mock("./parseIni");
jest.mock("./slurpFile");
jest.mock("./getHomeDir");

describe("loadSharedConfigFiles", () => {
  const mockConfigFilepath = "/mock/file/path/config";
  const mockCredsFilepath = "/mock/file/path/credentials";
  const mockSharedConfigFiles = {
    configFile: mockConfigFilepath,
    credentialsFile: mockCredsFilepath,
  };
  const mockHomeDir = "/users/alias";

  beforeEach(() => {
    (getConfigFilepath as jest.Mock).mockReturnValue(mockConfigFilepath);
    (getCredentialsFilepath as jest.Mock).mockReturnValue(mockCredsFilepath);
    (parseIni as jest.Mock).mockImplementation((args) => args);
    (getConfigData as jest.Mock).mockImplementation((args) => args);
    (slurpFile as jest.Mock).mockImplementation((path) => Promise.resolve(path));
    (getHomeDir as jest.Mock).mockReturnValue(mockHomeDir);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
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
      (slurpFile as jest.Mock).mockRejectedValue("error");
      const sharedConfigFiles = await loadSharedConfigFiles();
      expect(sharedConfigFiles).toStrictEqual({ configFile: {}, credentialsFile: {} });
    });

    it("when parseIni throws error", async () => {
      (parseIni as jest.Mock).mockRejectedValue("error");
      const sharedConfigFiles = await loadSharedConfigFiles();
      expect(sharedConfigFiles).toStrictEqual({ configFile: {}, credentialsFile: {} });
    });

    it("when normalizeConfigFile throws error", async () => {
      (getConfigData as jest.Mock).mockRejectedValue("error");
      const sharedConfigFiles = await loadSharedConfigFiles();
      expect(sharedConfigFiles).toStrictEqual({
        configFile: {},
        credentialsFile: mockCredsFilepath,
      });
    });
  });
});
