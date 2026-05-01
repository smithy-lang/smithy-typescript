import { describe, expect, test as it } from "vitest";

import { externalDataInterceptor } from "./externalDataInterceptor";
import { getSSOTokenFromFile } from "./getSSOTokenFromFile";
import { readFile } from "./readFile";

describe("fileMockController", () => {
  it("intercepts readFile", async () => {
    externalDataInterceptor.interceptFile("abcd", "contents");

    expect(await readFile("abcd")).toEqual("contents");
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
