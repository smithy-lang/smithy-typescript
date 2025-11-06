import * as promises from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

describe("readFile", () => {
  const UTF8 = "utf8";
  const getMockFileContents = (path: string, options = UTF8) => JSON.stringify({ path, options });

  beforeEach(() => {
    (promises.readFile as any).mockImplementation(async (path: any, options: any) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return getMockFileContents(path, options);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("makes one readFile call for a filepath irrespective of readFile calls", () => {
    it.each([10, 100, 1000, 10000])("parallel calls: %d ", async (num: number) => {
      const { readFile } = await import("./readFile");
      const mockPath = "/mock/path";
      const mockPathContent = getMockFileContents(mockPath);

      expect(promises.readFile).not.toHaveBeenCalled();
      const fileContentArr = await Promise.all(Array(num).fill(readFile(mockPath)));
      expect(fileContentArr).toStrictEqual(Array(num).fill(mockPathContent));

      // There is one readFile call even through readFile is called in parallel num times.
      expect(promises.readFile).toHaveBeenCalledTimes(1);
      expect(promises.readFile).toHaveBeenCalledWith(mockPath, UTF8);
    });

    it("two parallel calls and one sequential call", async () => {
      const { readFile } = await import("./readFile");
      const mockPath = "/mock/path";
      const mockPathContent = getMockFileContents(mockPath);

      expect(promises.readFile).not.toHaveBeenCalled();
      const fileContentArr = await Promise.all([readFile(mockPath), readFile(mockPath)]);
      expect(fileContentArr).toStrictEqual([mockPathContent, mockPathContent]);

      // There is one readFile call even through readFile is called in parallel twice.
      expect(promises.readFile).toHaveBeenCalledTimes(1);
      expect(promises.readFile).toHaveBeenCalledWith(mockPath, UTF8);

      const fileContent = await readFile(mockPath);
      expect(fileContent).toStrictEqual(mockPathContent);

      // There is one readFile call even through readFile is called for the third time.
      expect(promises.readFile).toHaveBeenCalledTimes(1);
    });
  });

  it("makes multiple readFile calls with based on filepaths", async () => {
    const { readFile } = await import("./readFile");

    const mockPath1 = "/mock/path/1";
    const mockPathContent1 = getMockFileContents(mockPath1);

    const mockPath2 = "/mock/path/2";
    const mockPathContent2 = getMockFileContents(mockPath2);

    expect(promises.readFile).not.toHaveBeenCalled();
    const fileContentArr = await Promise.all([readFile(mockPath1), readFile(mockPath2)]);
    expect(fileContentArr).toStrictEqual([mockPathContent1, mockPathContent2]);

    // There are two readFile calls as readFile is called in parallel with different filepaths.
    expect(promises.readFile).toHaveBeenCalledTimes(2);
    expect(promises.readFile).toHaveBeenNthCalledWith(1, mockPath1, UTF8);
    expect(promises.readFile).toHaveBeenNthCalledWith(2, mockPath2, UTF8);

    const fileContent1 = await readFile(mockPath1);
    expect(fileContent1).toStrictEqual(mockPathContent1);
    const fileContent2 = await readFile(mockPath2);
    expect(fileContent2).toStrictEqual(mockPathContent2);

    // There is one readFile call even through readFile is called for the third time.
    expect(promises.readFile).toHaveBeenCalledTimes(2);
  });

  it("makes multiple readFile calls when called with ignoreCache option", async () => {
    const { readFile } = await import("./readFile");

    const mockPath1 = "/mock/path/1";
    const mockPathContent1 = getMockFileContents(mockPath1);

    expect(promises.readFile).not.toHaveBeenCalled();
    const fileContentArr = await Promise.all([
      readFile(mockPath1, { ignoreCache: true }),
      readFile(mockPath1, { ignoreCache: true }),
    ]);
    expect(fileContentArr).toStrictEqual([mockPathContent1, mockPathContent1]);

    // There are two readFile calls as readFile is called in parallel with the same filepath.
    expect(promises.readFile).toHaveBeenCalledTimes(2);
    expect(promises.readFile).toHaveBeenNthCalledWith(1, mockPath1, UTF8);
    expect(promises.readFile).toHaveBeenNthCalledWith(2, mockPath1, UTF8);

    const fileContent1 = await readFile(mockPath1);
    expect(fileContent1).toStrictEqual(mockPathContent1);

    // There is no readFile call since readFile is now called without refresh.
    expect(promises.readFile).toHaveBeenCalledTimes(2);
  });
});
