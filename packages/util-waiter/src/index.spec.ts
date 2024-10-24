import { describe, expect, test as it } from "vitest";

import * as exported from "./index";

describe("Waiter util module exports", () => {
  it("should export the proper functions", () => {
    expect(exported.createWaiter).toBeDefined();
  });
});
