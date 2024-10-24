import { homedir } from "os";
import { sep } from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getHomeDir } from "./getHomeDir";

vi.mock("os");

describe(getHomeDir.name, () => {
  const mockUid = 1;
  const mockHOME = "mockHOME";
  const mockUSERPROFILE = "mockUSERPROFILE";
  const mockHOMEPATH = "mockHOMEPATH";
  const mockHOMEDRIVE = "mockHOMEDRIVE";
  const mockHomeDir = "mockHomeDir";

  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.mocked(homedir).mockReturnValue(mockHomeDir);
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
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns value in process.env.HOME first", () => {
    expect(getHomeDir()).toEqual(mockHOME);
    expect(homedir).not.toHaveBeenCalled();
  });

  it("returns value in process.env.USERPROFILE second", () => {
    process.env = { ...process.env, HOME: undefined };
    expect(getHomeDir()).toEqual(mockUSERPROFILE);
    expect(homedir).not.toHaveBeenCalled();
  });

  describe("returns value in HOMEPATH third", () => {
    beforeEach(() => {
      process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined };
    });

    afterEach(() => {
      expect(homedir).not.toHaveBeenCalled();
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
    const processGeteuidSpy = vi.spyOn(process, "geteuid").mockReturnValue(mockUid);
    process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };
    expect(getHomeDir()).toEqual(mockHomeDir);
    expect(homedir).toHaveBeenCalledTimes(1);
    expect(processGeteuidSpy).toHaveBeenCalledTimes(1);
  });

  describe("makes one homedir call irrespective of getHomeDir calls", async () => {
    const testSingleHomeDirCall = async (num: number) => {
      const { getHomeDir } = await import("./getHomeDir");
      process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };

      expect(homedir).not.toHaveBeenCalled();
      const homeDirArr = Array(num)
        .fill(num)
        .map(() => getHomeDir());
      expect(homeDirArr).toStrictEqual(Array(num).fill(mockHomeDir));

      // There is one homedir call even through getHomeDir is called num times.
      expect(homedir).toHaveBeenCalledTimes(1);
    };

    describe("when geteuid is available", () => {
      it.each([10, 100, 1000, 10000])("calls: %d ", async (num: number) => {
        const processGeteuidSpy = vi.spyOn(process, "geteuid").mockReturnValue(mockUid);
        expect(processGeteuidSpy).not.toHaveBeenCalled();
        await testSingleHomeDirCall(num);
        expect(processGeteuidSpy).toHaveBeenCalledTimes(num);
      });
    });

    describe("when geteuid is not available", () => {
      const OLD_GETEUID = process.geteuid;

      beforeAll(() => {
        // @ts-ignore Type 'undefined' is not assignable to type '() => number'.
        process.geteuid = undefined;
      });

      afterAll(() => {
        process.geteuid = OLD_GETEUID;
      });

      it.each([10, 100, 1000, 10000])("calls: %d ", testSingleHomeDirCall);
    });
  });

  describe("makes multiple homedir calls with based on UIDs", async () => {
    it.each([2, 10, 100])("calls: %d ", async (num: number) => {
      const { getHomeDir } = await import("./getHomeDir");
      const processGeteuidSpy = vi.spyOn(process, "geteuid");
      processGeteuidSpy.mockReturnValue(mockUid);
      for (let i = 0; i < num; i++) {
        processGeteuidSpy.mockReturnValueOnce(mockUid + i);
      }
      process.env = { ...process.env, HOME: undefined, USERPROFILE: undefined, HOMEPATH: undefined };

      expect(homedir).not.toHaveBeenCalled();
      expect(processGeteuidSpy).not.toHaveBeenCalled();
      const homeDirArr = Array(num)
        .fill(num)
        .map(() => getHomeDir());
      expect(homeDirArr).toStrictEqual(Array(num).fill(mockHomeDir));

      // There is num homedir calls as each call returns different UID
      expect(homedir).toHaveBeenCalledTimes(num);
      expect(processGeteuidSpy).toHaveBeenCalledTimes(num);

      const homeDir = getHomeDir();
      expect(homeDir).toStrictEqual(mockHomeDir);

      // No extra calls made to homedir, as mockUid is same as the first call.
      expect(homedir).toHaveBeenCalledTimes(num);
      // Extra call was made to geteuid to get the same UID as the first call.
      expect(processGeteuidSpy).toHaveBeenCalledTimes(num + 1);
    });
  });
});
