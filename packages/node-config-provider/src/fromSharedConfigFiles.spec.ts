import { CredentialsProviderError } from "@smithy/property-provider";
import { getProfileName, loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";
import { ParsedIniData, Profile } from "@smithy/types";

import { fromSharedConfigFiles, GetterFromConfig, SharedConfigInit } from "./fromSharedConfigFiles";

jest.mock("@smithy/shared-ini-file-loader", () => ({
  getProfileName: jest.fn(),
  loadSharedConfigFiles: jest.fn(),
}));

describe("fromSharedConfigFiles", () => {
  const CONFIG_KEY = "config_key";
  const configGetter: GetterFromConfig<string> = (profile: Profile) => profile[CONFIG_KEY];

  const getCredentialsProviderError = (profile: string) =>
    new CredentialsProviderError(`Not found in config files w/ profile [${profile}]: CONFIG_KEY`, {});

  describe("loadedConfig", () => {
    const mockConfigAnswer = "mockConfigAnswer";
    const mockConfigNotAnswer = "mockConfigNotAnswer";
    const mockCredentialsAnswer = "mockCredentialsAnswer";
    const mockCredentialsNotAnswer = "mockCredentialsNotAnswer";

    type LoadedConfigTestData = {
      message: string;
      iniDataInConfig: ParsedIniData;
      iniDataInCredentials: ParsedIniData;
    } & SharedConfigInit;

    const loadedConfigResolves: (LoadedConfigTestData & {
      configValueToVerify: string;
    })[] = [
      {
        message: "returns configValue from default profile",
        iniDataInConfig: {
          default: { [CONFIG_KEY]: mockConfigAnswer },
        },
        iniDataInCredentials: {
          default: { [CONFIG_KEY]: mockCredentialsNotAnswer },
        },
        configValueToVerify: mockConfigAnswer,
      },
      {
        message: "returns configValue from designated profile",
        iniDataInConfig: {
          default: { [CONFIG_KEY]: mockConfigNotAnswer },
          foo: { [CONFIG_KEY]: mockConfigAnswer },
        },
        iniDataInCredentials: {
          foo: { [CONFIG_KEY]: mockCredentialsNotAnswer },
        },
        profile: "foo",
        configValueToVerify: mockConfigAnswer,
      },
      {
        message: "returns configValue from credentials file if preferred",
        iniDataInConfig: {
          default: { [CONFIG_KEY]: mockConfigNotAnswer },
          foo: { [CONFIG_KEY]: mockConfigNotAnswer },
        },
        iniDataInCredentials: {
          foo: { [CONFIG_KEY]: mockCredentialsAnswer },
        },
        profile: "foo",
        preferredFile: "credentials",
        configValueToVerify: mockCredentialsAnswer,
      },
      {
        message: "returns configValue from config file if preferred credentials file doesn't contain config",
        iniDataInConfig: {
          foo: { [CONFIG_KEY]: mockConfigAnswer },
        },
        iniDataInCredentials: {},
        configValueToVerify: mockConfigAnswer,
        preferredFile: "credentials",
        profile: "foo",
      },
      {
        message: "returns configValue from credential file if preferred config file doesn't contain config",
        iniDataInConfig: {},
        iniDataInCredentials: {
          foo: { [CONFIG_KEY]: mockCredentialsAnswer },
        },
        configValueToVerify: mockCredentialsAnswer,
        profile: "foo",
      },
    ];

    const loadedConfigRejects: LoadedConfigTestData[] = [
      {
        message: "rejects if default profile is not present and profile value is not passed",
        iniDataInConfig: {
          foo: { [CONFIG_KEY]: mockConfigNotAnswer },
        },
        iniDataInCredentials: {},
      },
      {
        message: "rejects if designated profile is not present",
        iniDataInConfig: {
          default: { [CONFIG_KEY]: mockConfigNotAnswer },
        },
        iniDataInCredentials: {},
        profile: "foo",
      },
    ];

    loadedConfigResolves.forEach(
      ({ message, iniDataInConfig, iniDataInCredentials, configValueToVerify, profile, preferredFile }) => {
        it(message, () => {
          (loadSharedConfigFiles as jest.Mock).mockResolvedValueOnce({
            configFile: iniDataInConfig,
            credentialsFile: iniDataInCredentials,
          });
          (getProfileName as jest.Mock).mockReturnValueOnce(profile ?? "default");
          return expect(fromSharedConfigFiles(configGetter, { profile, preferredFile })()).resolves.toBe(
            configValueToVerify
          );
        });
      }
    );

    loadedConfigRejects.forEach(({ message, iniDataInConfig, iniDataInCredentials, profile, preferredFile }) => {
      it(message, () => {
        (loadSharedConfigFiles as jest.Mock).mockResolvedValueOnce({
          configFile: iniDataInConfig,
          credentialsFile: iniDataInCredentials,
        });
        (getProfileName as jest.Mock).mockReturnValueOnce(profile ?? "default");
        return expect(fromSharedConfigFiles(configGetter, { profile, preferredFile })()).rejects.toEqual(
          getCredentialsProviderError(profile ?? "default")
        );
      });
    });

    it("rejects if getter throws", () => {
      const message = "Cannot load config";
      const failGetter = () => {
        throw new Error(message);
      };
      (loadSharedConfigFiles as jest.Mock).mockResolvedValueOnce({
        configFile: {},
        credentialsFile: {},
      });
      return expect(fromSharedConfigFiles(failGetter)()).rejects.toEqual(new CredentialsProviderError(message));
    });
  });

  describe("profile", () => {
    const loadedConfigData = {
      configFile: {
        default: { [CONFIG_KEY]: "configFileDefault" },
        foo: { [CONFIG_KEY]: "configFileFoo" },
      },
      credentialsFile: {
        default: { [CONFIG_KEY]: "credentialsFileDefault" },
      },
    };

    beforeEach(() => {
      (loadSharedConfigFiles as jest.Mock).mockResolvedValueOnce(loadedConfigData);
    });

    it.each(["foo", "default"])("returns config value from %s profile", (profile) => {
      (getProfileName as jest.Mock).mockReturnValueOnce(profile);
      return expect(fromSharedConfigFiles(configGetter)()).resolves.toBe(
        loadedConfigData.configFile[profile][CONFIG_KEY]
      );
    });
  });
});
