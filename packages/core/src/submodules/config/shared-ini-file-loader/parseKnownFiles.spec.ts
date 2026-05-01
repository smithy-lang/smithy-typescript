import { afterEach, describe, expect, test as it, vi } from "vitest";

import { loadSharedConfigFiles } from "./loadSharedConfigFiles";
import { parseKnownFiles } from "./parseKnownFiles";

vi.mock("./loadSharedConfigFiles");

describe(parseKnownFiles.name, () => {
  const mockConfigFile = {
    profileName1: { configKey1: "configValue1" },
    profileName2: { configKey2: "configValue2" },
  };
  const mockCredentialsFile = {
    profileName1: { credsKey1: "credsValue1" },
    profileName2: { credsKey2: "credsValue2" },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("gets parsedFiles from loadSharedConfigFiles", async () => {
    vi.mocked(loadSharedConfigFiles).mockReturnValue(
      Promise.resolve({
        configFile: mockConfigFile,
        credentialsFile: mockCredentialsFile,
      })
    );
    const mockInit = { profile: "mockProfile" };
    const parsedFiles = await parseKnownFiles(mockInit);

    expect(loadSharedConfigFiles).toHaveBeenCalledWith(mockInit);
    expect(parsedFiles).toMatchInlineSnapshot(`
      {
        "profileName1": {
          "configKey1": "configValue1",
          "credsKey1": "credsValue1",
        },
        "profileName2": {
          "configKey2": "configValue2",
          "credsKey2": "credsValue2",
        },
      }
    `);
  });
});
