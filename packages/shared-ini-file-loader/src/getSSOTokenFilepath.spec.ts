import { createHash } from "crypto";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getHomeDir } from "./getHomeDir";
import { getSSOTokenFilepath } from "./getSSOTokenFilepath";

vi.mock("crypto");
vi.mock("./getHomeDir");

describe(getSSOTokenFilepath.name, () => {
  const mockCacheName = "mockCacheName";
  const mockDigest = vi.fn().mockReturnValue(mockCacheName);
  const mockUpdate = vi.fn().mockReturnValue({ digest: mockDigest });
  const mockHomeDir = "/home/dir";
  const mockSsoStartUrl = "mock_sso_start_url";

  beforeEach(() => {
    vi.mocked(createHash).mockReturnValue({ update: mockUpdate });
    vi.mocked(getHomeDir).mockReturnValue(mockHomeDir);
  });

  afterEach(() => {
    expect(createHash).toHaveBeenCalledWith("sha1");
    vi.clearAllMocks();
  });

  describe("re-throws error", () => {
    const mockError = new Error("error");

    it("when createHash throws error", () => {
      vi.mocked(createHash).mockImplementationOnce(() => {
        throw mockError;
      });
      expect(() => getSSOTokenFilepath(mockSsoStartUrl)).toThrow(mockError);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockDigest).not.toHaveBeenCalled();
      expect(getHomeDir).not.toHaveBeenCalled();
    });

    it("when hash.update() throws error", () => {
      mockUpdate.mockImplementationOnce(() => {
        throw mockError;
      });
      expect(() => getSSOTokenFilepath(mockSsoStartUrl)).toThrow(mockError);
      expect(mockUpdate).toHaveBeenCalledWith(mockSsoStartUrl);
      expect(mockDigest).not.toHaveBeenCalled();
      expect(getHomeDir).not.toHaveBeenCalled();
    });

    it("when hash.digest() throws error", () => {
      mockDigest.mockImplementationOnce(() => {
        throw mockError;
      });
      expect(() => getSSOTokenFilepath(mockSsoStartUrl)).toThrow(mockError);
      expect(mockUpdate).toHaveBeenCalledWith(mockSsoStartUrl);
      expect(mockDigest).toHaveBeenCalledWith("hex");
      expect(getHomeDir).not.toHaveBeenCalled();
    });

    it("when getHomeDir() throws error", () => {
      vi.mocked(getHomeDir).mockImplementationOnce(() => {
        throw mockError;
      });
      expect(() => getSSOTokenFilepath(mockSsoStartUrl)).toThrow(mockError);
      expect(mockUpdate).toHaveBeenCalledWith(mockSsoStartUrl);
      expect(mockDigest).toHaveBeenCalledWith("hex");
      expect(getHomeDir).toHaveBeenCalled();
    });
  });

  it("returns token filepath", () => {
    const ssoTokenFilepath = getSSOTokenFilepath(mockSsoStartUrl);
    expect(ssoTokenFilepath).toStrictEqual(join(mockHomeDir, ".aws", "sso", "cache", `${mockCacheName}.json`));
    expect(mockUpdate).toHaveBeenCalledWith(mockSsoStartUrl);
    expect(mockDigest).toHaveBeenCalledWith("hex");
    expect(getHomeDir).toHaveBeenCalled();
  });
});
