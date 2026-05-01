import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getConfigFilepath } from "./getConfigFilepath";
import { getSsoSessionData } from "./getSsoSessionData";
import { loadSsoSessionData } from "./loadSsoSessionData";
import { parseIni } from "./parseIni";
import { readFile } from "./readFile";

vi.mock("./getConfigFilepath");
vi.mock("./getSsoSessionData");
vi.mock("./parseIni");
vi.mock("./readFile");

describe(loadSsoSessionData.name, () => {
  const mockConfigFilepath = "/mock/file/path/config";
  const mockSsoSessionData = { test: { key: "value" } };

  beforeEach(() => {
    vi.mocked(getConfigFilepath).mockReturnValue(mockConfigFilepath);
    vi.mocked(parseIni).mockImplementation((args: any) => args);
    vi.mocked(getSsoSessionData).mockReturnValue(mockSsoSessionData);
    vi.mocked(readFile).mockImplementation((path) => Promise.resolve(path));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns configFile from default locations", async () => {
    const ssoSessionData = await loadSsoSessionData();
    expect(ssoSessionData).toStrictEqual(mockSsoSessionData);
    expect(getConfigFilepath).toHaveBeenCalledWith();
  });

  it("returns configFile from init if defined", async () => {
    const ssoSessionData = await loadSsoSessionData({
      configFilepath: mockConfigFilepath,
    });
    expect(ssoSessionData).toStrictEqual(mockSsoSessionData);
    expect(getConfigFilepath).not.toHaveBeenCalled();
  });

  describe("swallows error and returns empty configuration", () => {
    it("when readFile throws error", async () => {
      vi.mocked(readFile).mockRejectedValue("error");
      const ssoSessionData = await loadSsoSessionData();
      expect(ssoSessionData).toStrictEqual({});
    });

    it("when parseIni throws error", async () => {
      vi.mocked(parseIni).mockRejectedValue("error");
      const ssoSessionData = await loadSsoSessionData();
      expect(ssoSessionData).toStrictEqual({});
    });

    it("when normalizeConfigFile throws error", async () => {
      vi.mocked(getSsoSessionData).mockRejectedValue("error");
      const ssoSessionData = await loadSsoSessionData();
      expect(ssoSessionData).toStrictEqual({});
    });
  });
});
