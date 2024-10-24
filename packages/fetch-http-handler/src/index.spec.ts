import { describe, expect, test as it } from "vitest";

import { FetchHttpHandler } from "./index";

describe("index", () => {
  it("exports FetchHttpHandler", () => {
    expect(typeof FetchHttpHandler).toBe("function");
  });
});
