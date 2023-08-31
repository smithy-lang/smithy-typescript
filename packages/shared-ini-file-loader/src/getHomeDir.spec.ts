import { homedir } from "os";
import { sep } from "path";

import { getHomeDir } from "./getHomeDir";

jest.mock("os");

describe(getHomeDir.name, () => {
  const mockHOME = "mockHOME";
  const mockUSERPROFILE = "mockUSERPROFILE";
  const mockHOMEPATH = "mockHOMEPATH";
  const mockHOMEDRIVE = "mockHOMEDRIVE";
  const mockHomeDir = "mockHomeDir";

  const OLD_ENV = process.env;

  beforeEach(() => {
    (homedir as jest.Mock).mockReturnValue(mockHomeDir);
    process.env = {
      ...OLD_ENV,
      HOME: mockHOME,
      USERPROFILE: mockUSERPROFILE,
      HOMEPATH: mockHOMEPATH,
      HOMEDRIVE: mockHOMEDRIVE,
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("returns value in process.env.HOME first", () => {
    expect(getHomeDir()).toEqual(mockHOME);
  });

  it("returns value in process.env.USERPROFILE second", () => {
    process.env = { ...process.env, HOME: undefined };
    expect(getHomeDir()).toEqual(mockUSERPROFILE);
  });

  describe("returns value in HOMEPATH third", () => {
    beforeEach(() => {
      process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined };
    });

    it("uses value in process.env.HOMEDRIVE if it's set", () => {
      expect(getHomeDir()).toEqual(`${mockHOMEDRIVE}${mockHOMEPATH}`);
    });

    it("uses default if process.env.HOMEDRIVE is not set", () => {
      process.env = { ...process.env, HOMEDRIVE: undefined };
      expect(getHomeDir()).toEqual(`C:${sep}${mockHOMEPATH}`);
    });
  });

  it("returns value from homedir fourth", () => {
    process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };
    expect(getHomeDir()).toEqual(mockHomeDir);
  });

  describe.only("makes one homedir call per user filepath irrespective of getHomeDir calls", () => {
    it.each([10 /**100, 1000, 10000*/])("parallel calls: %d ", (num: number) => {
      jest.isolateModules(() => {
        const { getHomeDir } = require("./getHomeDir");
        process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };

        expect(homedir).not.toHaveBeenCalled();
        const homeDirArr = Array(num)
          .fill(num)
          .map(() => getHomeDir());
        expect(homeDirArr).toStrictEqual(Array(num).fill(mockHomeDir));

        // There is one homedir call even through getHomeDir is called in parallel num times.
        expect(homedir).toHaveBeenCalledTimes(1);
      });
    });
  });
});
