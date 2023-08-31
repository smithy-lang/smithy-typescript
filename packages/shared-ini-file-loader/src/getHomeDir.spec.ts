import { homedir } from "os";
import { sep } from "path";

import { getHomeDir } from "./getHomeDir";

jest.mock("os");

describe(getHomeDir.name, () => {
  const mockUid = 1;
  const mockHOME = "mockHOME";
  const mockUSERPROFILE = "mockUSERPROFILE";
  const mockHOMEPATH = "mockHOMEPATH";
  const mockHOMEDRIVE = "mockHOMEDRIVE";
  const mockHomeDir = "mockHomeDir";

  const OLD_ENV = process.env;

  beforeEach(() => {
    (homedir as jest.Mock).mockReturnValue(mockHomeDir);
    jest.spyOn(process, "geteuid").mockReturnValue(mockUid);
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

  describe("makes one homedir call per UID irrespective of getHomeDir calls", () => {
    it.each([10, 100, 1000, 10000])("calls: %d ", (num: number) => {
      jest.isolateModules(() => {
        const { getHomeDir } = require("./getHomeDir");
        process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };

        expect(homedir).not.toHaveBeenCalled();
        const homeDirArr = Array(num)
          .fill(num)
          .map(() => getHomeDir());
        expect(homeDirArr).toStrictEqual(Array(num).fill(mockHomeDir));

        // There is one homedir call even through getHomeDir is called num times.
        expect(homedir).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("makes multiple homedir calls with based on UIDs", () => {
    it.each([2, 10, 100])("calls: %d ", (num: number) => {
      jest.isolateModules(() => {
        const { getHomeDir } = require("./getHomeDir");
        for (let i = 0; i < num; i++) {
          jest.spyOn(process, "geteuid").mockReturnValueOnce(mockUid + i);
        }
        process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };

        expect(homedir).not.toHaveBeenCalled();
        const homeDirArr = Array(num)
          .fill(num)
          .map(() => getHomeDir());
        expect(homeDirArr).toStrictEqual(Array(num).fill(mockHomeDir));

        // There is num homedir calls as each call returns different UID
        expect(homedir).toHaveBeenCalledTimes(num);

        const homeDir = getHomeDir();
        expect(homeDir).toStrictEqual(mockHomeDir);

        // No extra calls made to homedir, as mockUid is same as the first call.
        expect(homedir).toHaveBeenCalledTimes(num);
      });
    });
  });
});
