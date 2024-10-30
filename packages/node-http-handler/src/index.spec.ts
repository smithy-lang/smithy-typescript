import { describe, expect, test as it } from "vitest";

import { NodeHttpHandler } from "./index";

describe("index", () => {
  it("exports NodeHttpHandler", () => {
    expect(typeof NodeHttpHandler).toBe("function");
  });
});
