import { describe, expect, test as it } from "vitest";

import { externalDataInterceptor } from "./externalDataInterceptor";
import { getSSOTokenFromFile } from "./getSSOTokenFromFile";
import { slurpFile } from "./slurpFile";

describe("fileMockController", () => {
  it("intercepts slurpFile", async () => {
    externalDataInterceptor.interceptFile("abcd", "contents");

    expect(await slurpFile("abcd")).toEqual("contents");
    expect(externalDataInterceptor.getFileRecord()).toEqual({
      abcd: Promise.resolve("contents"),
    });
    expect(await externalDataInterceptor.getFileRecord().abcd).toEqual("contents");
  });

  it("intercepts getSSOTokenFromFile", async () => {
    externalDataInterceptor.interceptToken("TOKEN", "token-contents");

    expect(await getSSOTokenFromFile("TOKEN")).toEqual("token-contents");

    expect(externalDataInterceptor.getTokenRecord()).toEqual({
      TOKEN: "token-contents",
    });
  });
});
